export type LinkReasonCode = 'NAME_EXACT' | 'NAME_SIMILAR' | 'DOB_EXACT' | 'DOB_NEAR';
import { calendarDateDistance, calendarDateFrom } from './dormitory-calendar-date';

export interface LinkRankingInput {
  _id: unknown;
  student_code?: unknown;
  full_name?: unknown;
  date_bir?: unknown;
  class_id?: unknown;
  status?: unknown;
}

export interface RankedLinkCandidate extends LinkRankingInput {
  date_bir: string | null;
  match_score: number;
  recommended: boolean;
  match_reasons: LinkReasonCode[];
}

export function normalizeLinkName(value: unknown): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function levenshteinSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return Math.max(0, 1 - previous[right.length] / Math.max(left.length, right.length));
}

function diceSimilarity(left: string, right: string): number {
  const leftTokens = new Set(left.split(/\s+/).filter(Boolean));
  const rightTokens = new Set(right.split(/\s+/).filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  return (2 * intersection) / (leftTokens.size + rightTokens.size);
}

export function nameSimilarity(source: unknown, candidate: unknown): number {
  const left = normalizeLinkName(source);
  const right = normalizeLinkName(candidate);
  if (left && left === right) return 1;
  if (!left || !right) return 0;
  const tokenLeft = String(source || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi-VN').trim().replace(/\s+/g, ' ');
  const tokenRight = String(candidate || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi-VN').trim().replace(/\s+/g, ' ');
  return Math.min(1, Math.max(0, Math.max(levenshteinSimilarity(left, right), diceSimilarity(tokenLeft, tokenRight))));
}

export function birthDateSimilarity(source: unknown, candidate: unknown): { score: number; distance: number | null; date: string | null } {
  const left = calendarDateFrom(source);
  const right = calendarDateFrom(candidate);
  if (!left || !right) return { score: 0, distance: null, date: right };
  const distance = calendarDateDistance(left, right)!;
  if (distance === 0) return { score: 1, distance, date: right };
  if (distance === 1) return { score: 0.8, distance, date: right };
  if (distance <= 31) return { score: 0.7 - ((distance - 2) * 0.5) / 29, distance, date: right };
  return { score: 0, distance, date: right };
}

export function rankLinkCandidates(source: { full_name?: unknown; date_of_birth?: unknown }, candidates: LinkRankingInput[]): RankedLinkCandidate[] {
  const sourceName = normalizeLinkName(source.full_name);
  return candidates.map((candidate) => {
    const similarity = nameSimilarity(source.full_name, candidate.full_name);
    const birth = birthDateSimilarity(source.date_of_birth, candidate.date_bir);
    const score = Number.isFinite(similarity) && Number.isFinite(birth.score) ? Math.round(100 * (0.7 * similarity + 0.3 * birth.score)) : 0;
    const candidateName = normalizeLinkName(candidate.full_name);
    const reasons: LinkReasonCode[] = [];
    if (sourceName && sourceName === candidateName) reasons.push('NAME_EXACT');
    else if (similarity > 0) reasons.push('NAME_SIMILAR');
    if (birth.distance === 0) reasons.push('DOB_EXACT');
    else if (birth.distance !== null && birth.distance <= 31) reasons.push('DOB_NEAR');
    return { ...candidate, date_bir: birth.date, match_score: score, recommended: score >= 60 && (birth.distance !== null && birth.distance <= 31 || Boolean(sourceName && sourceName === candidateName)), match_reasons: reasons };
  }).sort((left, right) => Number(right.recommended) - Number(left.recommended) || right.match_score - left.match_score || Number((right.match_reasons || []).includes('DOB_EXACT')) - Number((left.match_reasons || []).includes('DOB_EXACT')) || nameSimilarity(source.full_name, right.full_name) - nameSimilarity(source.full_name, left.full_name) || String(left.student_code || '').localeCompare(String(right.student_code || '')) || String(left._id).localeCompare(String(right._id)));
}
