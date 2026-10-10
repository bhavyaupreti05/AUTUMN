const fs = require('fs');

const fixes = [
  { file: 'src/pages/LoginPage.tsx', url: "'/auth/login'" },
  { file: 'src/pages/AdminPage.tsx', url: "'/auth/admin/analytics?range=all&user_id=all'" },
  { file: 'src/hooks/useDocuments.ts', url: "`/api/conversations/${conversationId}/documents`" },
  { file: 'src/hooks/useDocuments.ts', url: "'/api/documents'" },
  { file: 'src/hooks/useDocuments.ts', url: "`/api/conversations/${conversationId}/documents`" },
  { file: 'src/hooks/useDocuments.ts', url: "`/api/conversations/${conversationId}/documents/${docId}`" },
  { file: 'src/hooks/useConversations.ts', url: "'/api/conversations'" },
  { file: 'src/hooks/useConversations.ts', url: "`/api/conversations/${id}`" },
  { file: 'src/hooks/useConversations.ts', url: "`/api/conversations/${id}/title`" },
  { file: 'src/hooks/useConversations.ts', url: "`/api/conversations/${id}/${action}`" },
  { file: 'src/hooks/useChat.ts', url: "`/api/conversations/${initialConversationId}`" },
  { file: 'src/hooks/useChat.ts', url: "'/api/chat'" },
  { file: 'src/contexts/AuthContext.tsx', url: "'/auth/logout'" }
];

fixes.forEach(fix => {
    let content = fs.readFileSync(fix.file, 'utf8');
    content = content.replace(/fetch\(,\s*\{/, `fetch(${fix.url}, {`);
    fs.writeFileSync(fix.file, content, 'utf8');
});

