import { createAsyncThunk } from '@reduxjs/toolkit'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { AppDispatch } from '../store'
import { setStore } from '../slice'
import { State } from '../slice'

export const saveDebugState = createAsyncThunk<void, void, { dispatch: AppDispatch; state: State }>(
  'debug/saveState',
  async (_, { getState }) => {
    const state = getState()
    writeFileSync('.redux-state.json', JSON.stringify(state, null, 2))
  },
)

export const loadDebugState = createAsyncThunk<void, void, { dispatch: AppDispatch }>(
  'debug/loadState',
  async (_, { dispatch }) => {
    // If the file doesn't exist, do nothin.
    if (!existsSync('.redux-state.json')) return
    const stateJson = readFileSync('.redux-state.json', 'utf8')
    const state = JSON.parse(stateJson)
    dispatch(setStore(state))
  },
)
