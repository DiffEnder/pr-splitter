const HUNK_1 = {
  content: `@@ -0,0 +1,27 @@
+import logger from '../../../lib/src/logger'
+import { NextRequest, NextResponse } from 'next/server'
+
+export async function POST(request: NextRequest) {
+  const { level, meta } = await request.json()
+
+  if (typeof level !== 'string' || !['error', 'warn', 'info', 'debug'].includes(level)) {
+    return NextResponse.json({ success: false }, { status: 400 })
+  }
+
+  if (typeof meta !== 'object') {
+    return NextResponse.json({ success: false }, { status: 400 })
+  }
+
+  const message = 'client-side-log'
+
+  if (level === 'error') {
+    logger.error(meta, message)
+  } else if (level === 'warn') {
+    logger.warn(meta, message)
+  } else if (level === 'info') {
+    logger.info(meta, message)
+  } else {
+    logger.debug(meta, message)
+  }
+  return NextResponse.json({ success: true })
+}`,
  hash: 'bed3ea94',
}

const HUNK_2 = {
  content: `@@ -1,4 +1,4 @@
-import { faEllipsisH } from '@fortawesome/free-solid-svg-icons'
+import { faEllipsisH, faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons'
 import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
 import Popup from 'reactjs-popup'
 import { SimpleSpinner } from './Spinner'`,
  hash: '8f6e3da7',
}

const HUNK_3 = {
  content: `@@ -17,6 +17,7 @@ import {
 } from '../lib/features/comment/commentHelpers'
 import Link from 'next/link'
 import { Menu, MenuProps } from './Menu'
+import { SerializedError } from '@reduxjs/toolkit'
 
 export type EditCommentProps = {
   avatarUrl: string`,
  hash: '4c975ce5',
}

const HUNK_4 = {
  content: `@@ -32,7 +33,6 @@ export type EditCommentProps = {
 export const Comment = ({
   comment: { id, changed, text, author, createdAt, review },
   avatarUrl,
-  onClickDelete,
   onClickCancel,
   isEditing,
   editButtonProps,`,
  hash: '17bd2d10',
}

const HUNK_5 = {
  content: `@@ -79,6 +79,19 @@ export const Comment = ({
   )
 }
 
+export const CommentError = ({
+  error,
+  onClickClearError,
+}: {
+  error: SerializedError
+  onClickClearError: () => void
+}) => (
+  <div className={styles.errorContainer}>
+    <p>{error.message}</p>
+    <FontAwesomeIcon icon={faXmark} onClick={onClickClearError} />
+  </div>
+)
+
 export type CommentHeaderProps = {
   id: number
   avatarUrl: string`,
  hash: 'c91ad4da',
}

const HUNK_6 = {
  content: `@@ -33,6 +33,20 @@
   margin-bottom: 10px;
 }
 
+/* We concatenate the thread with the error message so we need to remove the top border */
+.threadWithError {
+  border-top-left-radius: 0;
+  border-top-right-radius: 0;
+  border-top: none;
+  margin-top: 0;
+}
+
+.errorContainerWithBorder {
+  border-top-left-radius: 6px;
+  border-top-right-radius: 6px;
+  border: 1px solid var(--color-border);
+}
+
 
 .comment {
   padding: 16px;`,
  hash: '877b1042',
}

const HUNK_7 = {
  content: `@@ -297,8 +311,7 @@
   justify-content: center;
   font-size: 14px;
   font-weight: 600;
-  border-bottom: 1px solid var(--color-border);
-  background-color: var(--color-error-bg);
+  background-color: var(--color-warning-bg);
   color: var(--color-primary);
   padding: 16px;
 }`,
  hash: 'f3a099b9',
}

const HUNK_8 = {
  content: `@@ -72,14 +72,14 @@ export const NewThread = ({
   return (
     <>
       {error ? (
-        <div className={styles.errorContainer}>
+        <div className={styles.errorContainer + ' ' + styles.errorContainerWithBorder}>
           <p>{error}</p>
           <FontAwesomeIcon className={styles.closeButton} icon={faX} onClick={onClickClearError} />
         </div>
       ) : null}
       {threadLabelElement}
       <div
-        className={\`\${styles.thread} \${styles.newThread} \${
+        className={\`\${styles.thread} \${styles.newThread} \${error ? styles.threadWithError : ''} \${
           isMarkdown ? styles.markdownThread : ''
         } thread\`}
       >`,
  hash: 'd4c5248d',
}

const HUNK_9 = {
  content: `@@ -8,7 +8,14 @@ import { encrypt } from '../lib/src/aes'
 
 export * from '@playwright/test'
 
-export const test = baseTest.extend<{}, { workerStorageState: string }>({
+export const test = baseTest.extend<{ cleanDb: void }, { workerStorageState: string }>({
+  // Add a new fixture to clean the database before each test
+  cleanDb: async ({}, use) => {
+    await use()
+    console.log('Cleaned database after test')
+    await prisma.$transaction([prisma.comment.deleteMany(), prisma.review.deleteMany()])
+  },
+
   // Use the same storage state for all tests in this worker.
   storageState: ({ workerStorageState }, use) => use(workerStorageState),
 `,
  hash: '6d34c60f',
}

const HUNK_10 = {
  content: `@@ -1,6 +1,10 @@
 import { test, expect } from './fixtures'
 
-test('allows a user to review a pull request', async ({ page }) => {
+test('allows a user to review a pull request', async ({
+  page,
+  // Playwright requires you to declare the fixture in the parameters list if you want it to run
+  cleanDb,
+}) => {
   // Try to access the dashboard
   await page.goto('http://localhost:3000/dashboard')
 `,
  hash: 'f41676ee',
}

const HUNK_11 = {
  content: `@@ -69,8 +73,49 @@ test('allows a user to review a pull request', async ({ page }) => {
   await expect(page.getByRole('button', { name: 'Finish your review 2' })).toBeVisible()
 })
 
+test('shows a warning if a review comment could not be posted to GitHub', async ({
+  page,
+  // Playwright requires you to declare the fixture in the parameters list if you want it to run
+  cleanDb,
+}) => {
+  await page.route('https://api.github.com/repos/**/**/pulls/**/reviews', (route) => {
+    route.fulfill({
+      status: 422,
+      body: JSON.stringify({
+        message: 'Unprocessable Entity',
+        errors: [
+          "Pull request review thread path diff too large and Pull request review thread diff hunk can't be blank",
+        ],
+        documentation_url:
+          'https://docs.github.com/rest/pulls/reviews#create-a-review-for-a-pull-request',
+        status: '422',
+      }),
+    })
+  })
+  // Try to access the pull request
+  await page.goto('http://localhost:3000/gitnotebooks-demo-user/e2e-tests/pull/1')
+
+  // Add a comment
+  await page.locator('.leftLineNumber.lineDiff').first().hover()
+  await page.locator('.leftLineNumber.lineDiff').first().locator('button').click()
+  await page.getByRole('textbox').fill('This is a test comment')
+
+  await expect(page.getByRole('button', { name: 'Add comment' })).toBeEnabled()
+  await expect(page.getByRole('button', { name: 'Start a review' })).toBeEnabled()
+
+  // Click the "Add comment" button
+  await page.getByRole('button', { name: 'Add comment' }).click()
+
+  // Expect there to be  a warning message that appears that says "Comment could not be cross-posted to GitHub because the diff is too large."
+  await expect(
+    page.getByText('Comment could not be cross-posted to GitHub because the diff is too large.'),
+  ).toBeVisible()
+})
+
 test.describe('when the user is not signed in', () => {
   test.use({ storageState: undefined })
+  // This test is retried once because it depends on GitHub's rate limiting.
+  // Since rate limits are based on IP address, the test may fail if the IP is already rate limited.
   test.describe.configure({ retries: 1 })
 
   test('allows a user to view a public pull request or give a proper error message if the rate limit is exceeded', async ({`,
  hash: '1471092f',
}

const HUNK_12 = {
  content: `@@ -90,6 +90,13 @@ export const apiSlice = createApi({
         body: { prCommentSetting },
       }),
     }),
+    log: builder.mutation({
+      query: (body: { level: 'error' | 'warn' | 'info' | 'debug'; meta: Record<string, any> }) => ({
+        url: '/logger',
+        method: 'POST',
+        body,
+      }),
+    }),
   }),
 })
 `,
  hash: 'cf649c76',
}

const HUNK_13 = {
  content: `@@ -32,6 +32,7 @@ type CommentState = {
   status: RequestStatus
   error: SerializedError | null
   commentResolutionErrorByThreadId: { [key: string]: SerializedError }
+  githubPostErrorByCommentId: { [key: number]: SerializedError | null }
 }
 
 const initialState: CommentState = {`,
  hash: '88bacb91',
}

const HUNK_14 = {
  content: `@@ -41,6 +42,7 @@ const initialState: CommentState = {
   reviewThreads: reviewThreadsAdapter.getInitialState(),
   reviewThreadIdByCommentProviderId: {},
   commentResolutionErrorByThreadId: {},
+  githubPostErrorByCommentId: {},
   error: null,
   status: 'idle',
 }`,
  hash: '9f08db89',
}

const HUNK_15 = {
  content: `@@ -58,6 +60,15 @@ export const commentSlice = createSlice({
     ) => {
       state.commentResolutionErrorByThreadId[action.payload.threadId] = action.payload.error
     },
+    githubErrorCleared: (state, action: PayloadAction<number>) => {
+      state.githubPostErrorByCommentId[action.payload] = null
+    },
+    githubErroredWhenSubmittingReview: (
+      state,
+      action: PayloadAction<{ error: SerializedError; commentId: number }>,
+    ) => {
+      state.githubPostErrorByCommentId[action.payload.commentId] = action.payload.error
+    },
   },
   extraReducers(builder) {
     builder`,
  hash: '20585342',
}

const HUNK_16 = {
  content: `@@ -116,7 +127,12 @@ export const commentSlice = createSlice({
   },
 })
 
-export const { commentResolutionErrored, threadResolveChanged } = commentSlice.actions
+export const {
+  commentResolutionErrored,
+  threadResolveChanged,
+  githubErroredWhenSubmittingReview,
+  githubErrorCleared,
+} = commentSlice.actions
 
 export const {
   selectById: selectCommentById,`,
  hash: '3ccd3943',
}

const HUNK_17 = {
  content: `@@ -7,6 +7,7 @@ import {
   submitReview,
   resolveReviewThread,
   unresolveReviewThread,
+  gitHubErrorMessageToHumanReadable,
 } from '../../src/github'
 import { AppDispatch, RootState } from '../../store'
 import {`,
  hash: '5b096b1f',
}

const HUNK_18 = {
  content: `@@ -19,7 +20,12 @@ import { ReviewStatus, ReviewThreads } from '../../src/state'
 import { apiSlice } from '../api/apiSlice'
 import { CommentCreateData } from './commentTypes'
 import { getCommentBodyWithContext, getCommentInsertData } from './commentHelpers'
-import { commentResolutionErrored, selectCommentById, threadResolveChanged } from './commentSlice'
+import {
+  commentResolutionErrored,
+  githubErroredWhenSubmittingReview,
+  selectCommentById,
+  threadResolveChanged,
+} from './commentSlice'
 import { selectCommentReplyInsertData } from './commentSelectors'
 import { GitHubReviewComment } from '../../src/github'
 import { selectCell, selectLanguageByFilePath } from '../notebookDiff/notebookDiffSelectors'`,
  hash: '0cc8735a',
}

const HUNK_19 = {
  content: `@@ -257,7 +263,7 @@ export const postSingleComment = createAsyncThunk<
   // then update the comment in our database with the provider ID from GitHub
   // so that it's immediately visible in GitNotebooks
   const octokit = new Octokit({ auth: accessToken })
-  const [{ comments: gitHubComments }, { data: gitNotebooksComment }] = await Promise.all([
+  const [githubResult, gitNotebooksResult] = await Promise.allSettled([
     submitReview(
       octokit,
       owner,`,
  hash: 'dbb1b095',
}

const HUNK_20 = {
  content: `@@ -276,20 +282,50 @@ export const postSingleComment = createAsyncThunk<
         comment: { ...commentInsertData, providerId: null },
         isReviewComment: false,
       }),
-    ),
+    ).unwrap(),
   ])
 
-  const maybeProviderId = gitHubComments[0].id
-  const providerId = maybeProviderId ? String(maybeProviderId) : null
-  if (gitNotebooksComment && providerId) {
-    // Update the comment in our database with the provider ID from GitHub
-    await dispatch(
-      apiSlice.endpoints.updateComment.initiate({
-        id: gitNotebooksComment.id,
-        providerId: providerId,
+  // Both succeeded, update the comment with GitHub ID
+  if (githubResult.status === 'fulfilled' && gitNotebooksResult.status === 'fulfilled') {
+    const gitHubComments = githubResult.value.comments
+    const maybeProviderId = gitHubComments[0].id
+    const providerId = maybeProviderId ? String(maybeProviderId) : null
+
+    if (gitNotebooksResult.value && providerId) {
+      await dispatch(
+        apiSlice.endpoints.updateComment.initiate({
+          id: gitNotebooksResult.value.id,
+          providerId: providerId,
+        }),
+      )
+    }
+  }
+
+  // Handle the case where GitHub failed but our database succeeded
+  // Post the error to the state so that we can show a warning in the UI
+  // that the comment could not be posted to GitHub
+  if (githubResult.status === 'rejected' && gitNotebooksResult.status === 'fulfilled') {
+    const error =
+      githubResult.reason instanceof Error
+        ? gitHubErrorMessageToHumanReadable(githubResult.reason)
+        : 'Failed to post comment to GitHub'
+    dispatch(
+      githubErroredWhenSubmittingReview({
+        error: { message: error },
+        commentId: gitNotebooksResult.value.id,
       }),
     )
   }
+
+  // They both failed so post a generic error message
+  if (githubResult.status === 'rejected' && gitNotebooksResult.status === 'rejected') {
+    throw new Error('Failed to post comment. Please try again.')
+  }
+
+  // GitHub succeeded but our database failed so post a generic error message
+  if (githubResult.status === 'fulfilled' && gitNotebooksResult.status === 'rejected') {
+    throw new Error('Failed to post comment. Please try again.')
+  }
 })
 
 // A review comment will either start a new review if one hasn't been started,`,
  hash: '1a601faf',
}

const HUNK_21 = {
  content: `@@ -1,9 +1,9 @@
 import { useEffect, useRef, useState } from 'react'
 import { useAppDispatch, useAppSelector } from '../../../hooks'
 import { selectAvatarUrlOrDefault } from '../../user/userSelectors'
-import { ButtonProps, Comment } from '../../../../components/Comment'
+import { ButtonProps, Comment, CommentError } from '../../../../components/Comment'
 import { selectUserCanModifyComment } from '../commentSelectors'
-import { selectCommentById } from '../commentSlice'
+import { githubErrorCleared, selectCommentById } from '../commentSlice'
 import { apiSlice } from '../../api/apiSlice'
 import { isEmpty } from 'lodash/fp'
 import { isEnterKey } from '../commentHelpers'`,
  hash: '07fe4dd3',
}

const HUNK_22 = {
  content: `@@ -20,6 +20,7 @@ export const CommentContainer = ({ commentId }: { commentId: number }) => {
   const textareaRef = useRef<HTMLTextAreaElement | null>(null)
   const [hasFocused, setHasFocused] = useState(false)
   const [editCommentText, setEditCommentText] = useState(comment.text)
+  const error = useAppSelector((state) => state.comment.githubPostErrorByCommentId[commentId])
 
   const onClickDelete = () => {
     if (!userCanModifyComment) return`,
  hash: '5f78a89b',
}

const HUNK_23 = {
  content: `@@ -59,6 +60,9 @@ export const CommentContainer = ({ commentId }: { commentId: number }) => {
     // the textarea will be focused
     setHasFocused(false)
   }
+  const onClickClearError = () => {
+    dispatch(githubErrorCleared(commentId))
+  }
 
   // We want to focus the edit textarea after they start editing the comment
   useEffect(() => {`,
  hash: '311f35a3',
}

const HUNK_24 = {
  content: `@@ -75,18 +79,21 @@ export const CommentContainer = ({ commentId }: { commentId: number }) => {
   ]
 
   return (
-    <Comment
-      avatarUrl={avatarUrl}
-      comment={comment}
-      editButtonProps={editButtonProps}
-      editCommentText={editCommentText}
-      isEditing={isEditing}
-      menuItems={menuItems}
-      onClickCancel={onClickCancel}
-      onClickDelete={onClickDelete}
-      onEditCommentTextChange={onEditCommentTextChange}
-      onEditTextAreaKeyDown={onEditTextAreaKeyDown}
-      setEditTextAreaRef={setEditTextAreaRef}
-    />
+    <>
+      <Comment
+        avatarUrl={avatarUrl}
+        comment={comment}
+        editButtonProps={editButtonProps}
+        editCommentText={editCommentText}
+        isEditing={isEditing}
+        menuItems={menuItems}
+        onClickCancel={onClickCancel}
+        onClickDelete={onClickDelete}
+        onEditCommentTextChange={onEditCommentTextChange}
+        onEditTextAreaKeyDown={onEditTextAreaKeyDown}
+        setEditTextAreaRef={setEditTextAreaRef}
+      />
+      {error ? <CommentError error={error} onClickClearError={onClickClearError} /> : null}
+    </>
   )
 }`,
  hash: '909bfa9f',
}

const HUNK_25 = {
  content: `@@ -5,6 +5,7 @@ import { ThreadContainerProps } from '../../comment/components/ThreadContainer'
 import { markdownSelectionCleared } from '../markdownSlice'
 import { MarkdownThread } from '../../../../components/MarkdownThread'
 import markdownStyles from '../../../../components/Markdown.module.css'
+import commentStyles from '../../../../components/Comments.module.css'
 
 export const MarkdownThreadContainer = ({}: {}) => {
   const dispatch = useAppDispatch()`,
  hash: 'd2af1a99',
}

const HUNK_26 = {
  content: `@@ -62,6 +63,7 @@ export const MarkdownThreadContainer = ({}: {}) => {
       \`.\${markdownStyles.commentable}\`,
       \`.\${markdownStyles.threadContainer}\`,
       \`.\${markdownStyles.commentLabel}\`,
+      \`.\${commentStyles.errorContainer}\`,
     ]
     const removeVisibleComment = (e: any) => {
       if (!REVIEW_THREAD_SELECTORS.some((selector) => e.target.closest(selector))) {`,
  hash: 'b6cefc92',
}

const HUNK_27 = {
  content: `@@ -71,15 +71,13 @@ export const initPullRequest = createAsyncThunk<
         notebookResults.forEach((result) => {
           if (result.status === 'fulfilled') {
             const { gitHubFile, notebookModel } = result.value
-            if (notebookModel) {
-              dispatch(
-                calculateInitialCollapsedDiffIndexes({
-                  gitHubFile,
-                  notebookModel,
-                  comments: commentsResult.comments,
-                }),
-              )
-            }
+            dispatch(
+              calculateInitialCollapsedDiffIndexes({
+                gitHubFile,
+                notebookModel,
+                comments: commentsResult.comments,
+              }),
+            )
           } else {
             console.error('Error processing notebook:', result.reason)
           }`,
  hash: '50d2dc35',
}

const HUNK_28 = {
  content: `@@ -0,0 +1,35 @@
+import { isRejected, Middleware } from '@reduxjs/toolkit'
+import { apiSlice } from './features/api/apiSlice'
+import { AppDispatch, RootState } from './store'
+
+export const loggerMiddleware = (({
+    getState,
+    dispatch,
+  }: {
+    getState: () => RootState
+    dispatch: AppDispatch
+  }) =>
+  (next) =>
+  (action) => {
+    if (!isRejected(action)) return next(action)
+
+    const state = getState()
+    const page = window.location.pathname
+    dispatch(
+      apiSlice.endpoints.log.initiate({
+        level: 'error',
+        meta: {
+          error: { message: action.error.message, name: action.error.name },
+          action: action.type,
+          actionPayload: action.payload,
+          user: {
+            username: state.user.user?.username ?? null,
+            settings: state.user.user?.settings ?? null,
+            userId: state.user.user?.id ?? null,
+          },
+          page,
+        },
+      }),
+    )
+    return next(action)
+  }) as Middleware`,
  hash: 'e285dee2',
}

const HUNK_29 = {
  content: `@@ -954,3 +954,10 @@ const processBlameRanges = (
     updatedAt: latestDate,
   }
 }
+
+export const gitHubErrorMessageToHumanReadable = (error: Error) => {
+  if (error.message.includes('path diff too large')) {
+    return 'Comment could not be cross-posted to GitHub because the diff is too large.'
+  }
+  return error.message
+}`,
  hash: 'a2397456',
}

const HUNK_30 = {
  content: `@@ -1,4 +1,4 @@
-import { configureStore } from '@reduxjs/toolkit'
+import { configureStore, isRejected, isRejectedWithValue } from '@reduxjs/toolkit'
 import { apiSlice } from './features/api/apiSlice'
 import blobReducer from './features/blob/blobSlice'
 import commentReducer from './features/comment/commentSlice'`,
  hash: '9114b10b',
}

const HUNK_31 = {
  content: `@@ -15,6 +15,7 @@ import userReducer from './features/user/userSlice'
 import repoSettingsReducer from './features/repoSettings/repoSettingsSlice'
 import repoReducer from './features/repo/repoSlice'
 import pullRequestsReducer from './features/pullRequests/pullRequestsSlice'
+import { loggerMiddleware } from './middleware'
 
 export const makeStore = () => {
   return configureStore({`,
  hash: '1a7810f3',
}

const HUNK_32 = {
  content: `@@ -36,7 +37,8 @@ export const makeStore = () => {
       user: userReducer,
       [apiSlice.reducerPath]: apiSlice.reducer,
     },
-    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(apiSlice.middleware),
+    middleware: (getDefaultMiddleware) =>
+      getDefaultMiddleware().concat(apiSlice.middleware, loggerMiddleware),
   })
 }
 `,
  hash: 'b3af5a3b',
}

const HUNK_33 = {
  content: `@@ -304,7 +304,7 @@
   /* Markdown body code background */
   --color-markdown-code-bg: rgba(175, 184, 193, 0.2);
   /* .hljs-section */
-  --color-code-section: #1f6feb;
+  --color-code-section: #79c0ff;
   /* .hljs-string */
   --color-code-string: #a5d6ff;
   /* .hljs-keyword, .hljs-literal */`,
  hash: '31651eac',
}

const HUNK_34 = {
  content: `@@ -319,6 +319,8 @@
   --color-code-number: #79c0ff;
   /* .hljs-built_in */
   --color-code-builtin: #ffa657;
+  /* .hljs-keyword */
+  --color-code-keyword: #ff7b72;
   /* .hljs-bullet */
   --color-code-bullet: #f2cc60;
   /* .hljs-code */`,
  hash: 'd03cf1a4',
}

const HUNK_35 = {
  content: `@@ -872,7 +874,10 @@ img.diff-added-line {
   color: var(--color-code-section) !important;
 }
 
-.hljs-keyword,
+.hljs-keyword {
+  color: var(--color-code-keyword) !important;
+}
+
 .hljs-literal {
   color: var(--color-code-literal) !important;
   font-weight: bold;
`,
  hash: '2a9ce6e0',
}

export default {
  groups: [
    // Logging
    [HUNK_1.hash, HUNK_12.hash, HUNK_28.hash, HUNK_30.hash, HUNK_31.hash, HUNK_32.hash],
    // GitHub comment error handling
    [
      HUNK_2.hash,
      HUNK_3.hash,
      HUNK_4.hash,
      HUNK_5.hash,
      HUNK_6.hash,
      HUNK_7.hash,
      HUNK_8.hash,
      HUNK_11.hash,
      HUNK_13.hash,
      HUNK_14.hash,
      HUNK_15.hash,
      HUNK_16.hash,
      HUNK_17.hash,
      HUNK_18.hash,
      HUNK_19.hash,
      HUNK_20.hash,
      HUNK_21.hash,
      HUNK_22.hash,
      HUNK_23.hash,
      HUNK_24.hash,
      HUNK_25.hash,
      HUNK_26.hash,
      HUNK_9.hash,
      HUNK_10.hash,
      HUNK_29.hash,
    ],
    // Random pull request thunk change
    [HUNK_27.hash],
    // Dark mode syntax colors
    [HUNK_33.hash, HUNK_34.hash, HUNK_35.hash],
  ],
}
