import re
import sys

try:
    with open('frontend/src/app/grading/score/page.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Imports
    import_dynamic = 'import dynamic from "next/dynamic";\nconst ScoreHistoryPanel = dynamic(() => import("./_components/ScoreHistoryPanel"), { ssr: false });\nconst DeleteHistoryModal = dynamic(() => import("./_components/DeleteHistoryModal"), { ssr: false });\n'
    if 'import dynamic from "next/dynamic";' not in content:
        content = content.replace('import { useRouter, useSearchParams } from "next/navigation";', 'import { useRouter, useSearchParams } from "next/navigation";\n' + import_dynamic)

    # 2. HistoryCard
    pattern = re.compile(r'interface HistoryCardProps \{.*?const HistoryCard:.*?return \(.*?\}\);\n\};\n\n', re.DOTALL)
    content = re.sub(pattern, '', content)

    # 3. History Tab
    tab_pattern = re.compile(r'\{subTab === "history" &&\s*activeStudent &&\s*\(\(\) => \{.*?\}\)\(\)\}', re.DOTALL)
    replacement = '''{subTab === "history" && activeStudent && (
              <ScoreHistoryPanel
                historyRecords={historyRecords.filter(r => r.studentId === activeStudentId) as any}
                isHistoryFetching={isHistoryFetching}
                historyPage={historyPage}
                setHistoryPage={(page) => {
                  setIsHistoryFetching(true);
                  setTimeout(() => {
                    setHistoryPage(page);
                    setIsHistoryFetching(false);
                  }, 400);
                }}
                setRecordToDelete={setRecordToDelete}
                setIsConfirmDeleteOpen={setIsConfirmDeleteOpen}
              />
            )}'''
    content = re.sub(tab_pattern, replacement, content)

    # 4. Modal
    modal_pattern = re.compile(r'\{/\* Modal xác nhận xóa lịch sử \*/\}.*?<AnimatePresence>.*?</AnimatePresence>', re.DOTALL)
    modal_replacement = '''{/* Modal xác nhận xóa lịch sử */}
          <DeleteHistoryModal 
            isOpen={isConfirmDeleteOpen && recordToDelete !== null}
            recordTitle={recordToDelete?.title || ""}
            onClose={() => {
              setIsConfirmDeleteOpen(false);
              setRecordToDelete(null);
            }}
            onConfirm={handleDeleteHistoryRecord}
          />'''
    content = re.sub(modal_pattern, modal_replacement, content)

    # 5. Fix limit for summaries point
    content = content.replace('summariesPointApi.getSummariesPoints(),', 'summariesPointApi.getSummariesPoints({ limit: 1000 }),')
    content = content.replace('setApiSummariesPoints(backendSummaries || []);', 'setApiSummariesPoints((backendSummaries as any)?.data || []);')
    content = content.replace('let filteredSummaries = (backendSummaries || []).filter((summary) => {', 'let filteredSummaries = ((backendSummaries as any)?.data || []).filter((summary: any) => {')


    with open('frontend/src/app/grading/score/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

    print('Updated successfully')
except Exception as e:
    print('Error:', str(e))
