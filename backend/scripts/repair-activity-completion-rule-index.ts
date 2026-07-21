import * as dotenv from 'dotenv';
import * as path from 'path';
import { MongoClient } from 'mongodb';

dotenv.config({ path: path.join(__dirname, '../.env') });

const LEGACY_INDEX = 'club_id_1_semester_id_1';
const CANONICAL_INDEX = 'activity_id_1_semester_id_1';

type RuleShapeSummary = {
  documents: number;
  legacyOnly: number;
  canonicalOnly: number;
  bothEqual: number;
  bothDifferent: number;
  missingActivity: number;
  duplicateCanonicalPairs: number;
};

async function main() {
  const execute = process.argv.includes('--execute');
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required');

  const client = await MongoClient.connect(uri);
  try {
    const collection = client.db().collection('activity_completion_rules');
    const indexes = await collection.indexes();
    const shape = await collection
      .aggregate<{
        _id: string;
        count: number;
      }>([
        {
          $project: {
            shape: {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [
                        { $ne: [{ $type: '$activity_id' }, 'missing'] },
                        { $eq: [{ $type: '$club_id' }, 'missing'] },
                      ],
                    },
                    then: 'canonicalOnly',
                  },
                  {
                    case: {
                      $and: [
                        { $eq: [{ $type: '$activity_id' }, 'missing'] },
                        { $ne: [{ $type: '$club_id' }, 'missing'] },
                      ],
                    },
                    then: 'legacyOnly',
                  },
                  {
                    case: {
                      $and: [
                        { $ne: [{ $type: '$activity_id' }, 'missing'] },
                        { $ne: [{ $type: '$club_id' }, 'missing'] },
                        { $eq: ['$activity_id', '$club_id'] },
                      ],
                    },
                    then: 'bothEqual',
                  },
                  {
                    case: {
                      $and: [
                        { $ne: [{ $type: '$activity_id' }, 'missing'] },
                        { $ne: [{ $type: '$club_id' }, 'missing'] },
                        { $ne: ['$activity_id', '$club_id'] },
                      ],
                    },
                    then: 'bothDifferent',
                  },
                ],
                default: 'missingActivity',
              },
            },
          },
        },
        { $group: { _id: '$shape', count: { $sum: 1 } } },
      ])
      .toArray();

    const duplicateCanonicalPairs = await collection
      .aggregate([
        {
          $project: {
            canonicalActivityId: { $ifNull: ['$activity_id', '$club_id'] },
            semester_id: 1,
          },
        },
        {
          $match: {
            canonicalActivityId: { $ne: null },
            semester_id: { $ne: null },
          },
        },
        {
          $group: {
            _id: {
              activity_id: '$canonicalActivityId',
              semester_id: '$semester_id',
            },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $count: 'count' },
      ])
      .toArray();

    const byShape = new Map(shape.map((entry) => [entry._id, entry.count]));
    const summary: RuleShapeSummary = {
      documents: await collection.countDocuments(),
      legacyOnly: byShape.get('legacyOnly') ?? 0,
      canonicalOnly: byShape.get('canonicalOnly') ?? 0,
      bothEqual: byShape.get('bothEqual') ?? 0,
      bothDifferent: byShape.get('bothDifferent') ?? 0,
      missingActivity: byShape.get('missingActivity') ?? 0,
      duplicateCanonicalPairs: duplicateCanonicalPairs[0]?.count ?? 0,
    };

    const hasLegacyIndex = indexes.some((index) => index.name === LEGACY_INDEX);
    const canonicalIndexes = indexes.filter((index) => index.name === CANONICAL_INDEX);
    console.log(
      JSON.stringify(
        {
          mode: execute ? 'execute' : 'dry-run',
          summary,
          indexes: indexes.map((index) => ({
            name: index.name,
            key: index.key,
            unique: index.unique === true,
          })),
          plannedChanges: {
            normalizeLegacyOnly: summary.legacyOnly,
            removeRedundantLegacyFields: summary.bothEqual,
            dropLegacyIndex: hasLegacyIndex,
            createCanonicalIndex:
              canonicalIndexes.length !== 1 || canonicalIndexes[0]?.unique !== true,
          },
        },
        null,
        2,
      ),
    );

    if (
      summary.bothDifferent > 0 ||
      summary.missingActivity > 0 ||
      summary.duplicateCanonicalPairs > 0
    ) {
      throw new Error(
        'Ambiguous or conflicting completion rules require data-owner review before migration.',
      );
    }

    if (!execute) return;

    if (hasLegacyIndex) await collection.dropIndex(LEGACY_INDEX);

    if (summary.legacyOnly > 0) {
      await collection.updateMany(
        { activity_id: { $exists: false }, club_id: { $exists: true } },
        { $rename: { club_id: 'activity_id' } },
      );
    }
    if (summary.bothEqual > 0) {
      await collection.updateMany(
        { activity_id: { $exists: true }, club_id: { $exists: true } },
        { $unset: { club_id: '' } },
      );
    }

    const postIndexes = await collection.indexes();
    const existingCanonical = postIndexes.find(
      (index) => index.name === CANONICAL_INDEX,
    );
    if (!existingCanonical) {
      await collection.createIndex(
        { activity_id: 1, semester_id: 1 },
        { unique: true, name: CANONICAL_INDEX },
      );
    } else if (existingCanonical.unique !== true) {
      throw new Error(
        `${CANONICAL_INDEX} exists but is not unique; manual review is required.`,
      );
    }

    const remainingLegacyFields = await collection.countDocuments({
      club_id: { $exists: true },
    });
    const legacyIndexStillPresent = (await collection.indexes()).some(
      (index) => index.name === LEGACY_INDEX,
    );
    if (remainingLegacyFields !== 0 || legacyIndexStillPresent) {
      throw new Error('Post-migration verification failed.');
    }
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
