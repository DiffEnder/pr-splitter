import { createAsyncThunk } from '@reduxjs/toolkit'
import { State, stepChanged, userClearedSelectedHunkGroup } from '../slice'
import { AppDispatch } from '../store'
import { Key } from 'ink'
import { loadDebugState, saveDebugState } from './debugThunks'

export const handleKeyboardInput = createAsyncThunk<
  void,
  { input: string; key: Key },
  { dispatch: AppDispatch; state: State }
>('app/handleKeyboardInput', async ({ input, key }, { dispatch, getState }) => {
  const state = getState()
  const page = state.page

  if (page === 'CREATING_PULL_REQUESTS') {
    if (state.prCreationStatus === 'ASKING_FOR_PERMISSION_TO_CREATE_PULL_REQUESTS') {
      if (key.escape) {
        dispatch(userClearedSelectedHunkGroup())
        return
      }
    }
  }

  // Uncomment this to add some special debugging keys for the menu page to load and save the redux state to a file.
  // meta + shift + s: snapshot the state to a file. (just for debugging)
  // if (key.shift && input === 'S') {
  //   dispatch(saveDebugState())
  //   return
  // }
  // // meta + shift + l: load the state from a file. (just for debugging)
  // if (key.shift && input === 'L') {
  //   dispatch(loadDebugState())
  //   return
  // }
})
