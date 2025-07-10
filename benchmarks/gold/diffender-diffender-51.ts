const HUNK_1 = {
  content: `@@ -577,7 +577,7 @@ export const addLinesToChat =
     if (!state.chat.selectedChatId) return
     const { baseSha, headSha } = selectHeadAndBaseSha(getState())
     const currentUserMessageDraftId = getUserMessageDraftId({ chatId: state.chat.selectedChatId })
-    dispatch(uiChanged({ isOpen: true }))
+    dispatch(uiChanged({ isOpen: true, selectedTab: 'chat' }))
     dispatch(userMessageFocused({ messageId: currentUserMessageDraftId }))
 
     if (!isNumber(editorLineIndex)) {`,
  hash: 'ebb43b6b',
}

const HUNK_2 = {
  content: `@@ -20,7 +20,7 @@ export const AddToChatContainer = React.memo(
     const dispatch = useAppDispatch()
     const onClick = useCallback(() => {
       dispatch(addSelectionToChat())
-      dispatch(uiChanged({ isOpen: true, addSelectionToChatLocation: null }))
+      dispatch(uiChanged({ isOpen: true, selectedTab: 'chat', addSelectionToChatLocation: null }))
     }, [dispatch])
     const isVisible = useAppSelector(
       (state) =>`,
  hash: 'c7050d4a',
}

const HUNK_3 = {
  content: `@@ -73,9 +73,12 @@ export const selectShouldShowDiffTreeToggleButton = createSelector(
   },
 )
 
-export const selectDiffTreeWidth = (state: RootState) => {
-  if (state.diffTree.view === 'expanded') return state.diffTree.containerWidth
-  return 0
-}
+export const selectDiffTreeWidth = createSelector(
+  selectShouldShowDiffTree,
+  (state: RootState) => state.diffTree.containerWidth,
+  (shouldShow, containerWidth) => {
+    return shouldShow ? containerWidth : 0
+  },
+)
 
 export const selectIsDiffTreeResizing = (state: RootState) => state.diffTree.isResizing`,
  hash: '12c544e7',
}

const HUNK_4 = {
  content: `@@ -154,7 +154,7 @@ export const PullRequestContainer = () => {
               className={styles.filesContainer}
               style={{
                 width: \`calc(100% - (\${chatWidth + diffTreeWidth + 64}px))\`,
-                marginLeft: diffTreeWidth + 32,
+                marginLeft: showTree ? diffTreeWidth + 32 : 32,
               }}
             >
               {gitHubFiles.map((file) => (
`,
  hash: 'a15854a6',
}

export default {
  groups: [
    // Chat tab open
    [HUNK_1.hash, HUNK_2.hash],
    // Diff tree width
    [HUNK_3.hash, HUNK_4.hash],
  ],
}
