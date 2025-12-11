import api from '@/api'
import { EMPTY_STRING, TASK_STATUS } from '@shared/constants'
import { checkTaskIsBT, intersection } from '@shared/utils'

const state = {
  currentList: 'all',
  taskDetailVisible: false,
  currentTaskGid: EMPTY_STRING,
  enabledFetchPeers: false,
  currentTaskItem: null,
  currentTaskFiles: [],
  currentTaskPeers: [],
  seedingList: [],
  taskList: [],
  selectedGidList: [],
  magnetStatuses: {},
  taskPriorities: {}
}

const getters = {
}

const mutations = {
  UPDATE_SEEDING_LIST (state, seedingList) {
    state.seedingList = seedingList
  },
  UPDATE_TASK_LIST (state, taskList) {
    state.taskList = taskList
  },
  UPDATE_SELECTED_GID_LIST (state, gidList) {
    state.selectedGidList = gidList
  },
  CHANGE_CURRENT_LIST (state, currentList) {
    state.currentList = currentList
  },
  CHANGE_TASK_DETAIL_VISIBLE (state, visible) {
    state.taskDetailVisible = visible
  },
  UPDATE_CURRENT_TASK_GID (state, gid) {
    state.currentTaskGid = gid
  },
  UPDATE_ENABLED_FETCH_PEERS (state, enabled) {
    state.enabledFetchPeers = enabled
  },
  UPDATE_CURRENT_TASK_ITEM (state, task) {
    state.currentTaskItem = task
  },
  UPDATE_CURRENT_TASK_FILES (state, files) {
    state.currentTaskFiles = files
  },
  UPDATE_CURRENT_TASK_PEERS (state, peers) {
    state.currentTaskPeers = peers
  },
  UPDATE_MAGNET_STATUS (state, payload) {
    const { gid, ...rest } = payload
    const prev = state.magnetStatuses[gid] || {}
    state.magnetStatuses = { ...state.magnetStatuses, [gid]: { ...prev, ...rest } }
  },
  CLEAR_MAGNET_STATUS (state, gid) {
    const next = { ...state.magnetStatuses }
    delete next[gid]
    state.magnetStatuses = next
  },
  UPDATE_TASK_PRIORITIES (state, mapping) {
    state.taskPriorities = { ...state.taskPriorities, ...mapping }
  }
}

const actions = {
  changeCurrentList ({ commit, dispatch }, currentList) {
    commit('CHANGE_CURRENT_LIST', currentList)
    commit('UPDATE_SELECTED_GID_LIST', [])
    dispatch('fetchList')
  },
  fetchList ({ commit, state, rootState }) {
    return api.fetchTaskList({ type: state.currentList })
      .then((data) => {
        commit('UPDATE_TASK_LIST', data)

        const { selectedGidList } = state
        const gids = data.map((task) => task.gid)
        const list = intersection(selectedGidList, gids)
        commit('UPDATE_SELECTED_GID_LIST', list)

        try {
          const saved = (rootState.preference && rootState.preference.config && rootState.preference.config.taskPriorities) || {}
          const mapping = {}
          data.forEach(task => {
            const dir = task.dir || ''
            let base = ''
            try {
              const fp = task.files && task.files[0] && (task.files[0].path || '')
              base = fp ? fp.split(/[\\/]/).pop() : ''
            } catch (_) {}
            if (dir && base) {
              const key = `${dir}|${base}`
              if (saved[key] != null) {
                mapping[task.gid] = Number(saved[key]) || 0
              }
            }
          })
          if (Object.keys(mapping).length > 0) {
            commit('UPDATE_TASK_PRIORITIES', mapping)
          }
        } catch (e) {}
      })
  },
  selectTasks ({ commit }, list) {
    commit('UPDATE_SELECTED_GID_LIST', list)
  },
  selectAllTask ({ commit, state }) {
    const gids = state.taskList.map((task) => task.gid)
    commit('UPDATE_SELECTED_GID_LIST', gids)
  },
  fetchItem ({ dispatch }, gid) {
    return api.fetchTaskItem({ gid })
      .then((data) => {
        dispatch('updateCurrentTaskItem', data)
      })
  },
  fetchItemWithPeers ({ dispatch }, gid) {
    return api.fetchTaskItemWithPeers({ gid })
      .then((data) => {
        console.log('fetchItemWithPeers===>', data)
        dispatch('updateCurrentTaskItem', data)
      })
  },
  showTaskDetailByGid ({ commit, dispatch }, gid) {
    api.fetchTaskItem({ gid })
      .then((task) => {
        dispatch('updateCurrentTaskItem', task)
        commit('UPDATE_CURRENT_TASK_GID', task.gid)
        commit('CHANGE_TASK_DETAIL_VISIBLE', true)
      })
  },
  showTaskDetail ({ commit, dispatch }, task) {
    dispatch('updateCurrentTaskItem', task)
    commit('UPDATE_CURRENT_TASK_GID', task.gid)
    commit('CHANGE_TASK_DETAIL_VISIBLE', true)
  },
  hideTaskDetail ({ commit }) {
    commit('CHANGE_TASK_DETAIL_VISIBLE', false)
  },
  toggleEnabledFetchPeers ({ commit }, enabled) {
    commit('UPDATE_ENABLED_FETCH_PEERS', enabled)
  },
  updateCurrentTaskItem ({ commit }, task) {
    commit('UPDATE_CURRENT_TASK_ITEM', task)
    if (task) {
      commit('UPDATE_CURRENT_TASK_FILES', task.files)
      commit('UPDATE_CURRENT_TASK_PEERS', task.peers)
    } else {
      commit('UPDATE_CURRENT_TASK_FILES', [])
      commit('UPDATE_CURRENT_TASK_PEERS', [])
    }
  },
  updateCurrentTaskGid ({ commit }, gid) {
    commit('UPDATE_CURRENT_TASK_GID', gid)
  },
  addUri ({ dispatch, commit, rootState }, data) {
    const { uris, outs, options, dirs, priorities } = data
    return api.addUri({ uris, outs, options, dirs })
      .then((res) => {
        if (Array.isArray(res)) {
          const gids = res.map(r => r && r[0]).filter(Boolean)
          if (Array.isArray(priorities) && priorities.length === gids.length) {
            const mapping = {}
            for (let i = 0; i < gids.length; i++) {
              mapping[gids[i]] = Number(priorities[i]) || 0
            }
            commit('UPDATE_TASK_PRIORITIES', mapping)

            try {
              const existing = (rootState.preference && rootState.preference.config && rootState.preference.config.taskPriorities) || {}
              const persist = { ...existing }
              for (let i = 0; i < gids.length; i++) {
                const dir = Array.isArray(dirs) && dirs[i] ? dirs[i] : (options && options.dir) || (rootState.preference && rootState.preference.config && rootState.preference.config.dir) || ''
                const out = Array.isArray(outs) && outs[i] ? outs[i] : ''
                if (dir && out) {
                  const key = `${dir}|${out}`
                  persist[key] = Number(priorities[i]) || 0
                }
              }
              dispatch('preference/save', { taskPriorities: persist }, { root: true })
            } catch (e) {}
          }
        }
        dispatch('fetchList')
        dispatch('app/updateAddTaskOptions', {}, { root: true })
      })
  },
  addTorrent ({ dispatch }, data) {
    const { torrent, options } = data
    return api.addTorrent({ torrent, options })
      .then(() => {
        dispatch('fetchList')
        dispatch('app/updateAddTaskOptions', {}, { root: true })
      })
  },
  addMetalink ({ dispatch }, data) {
    const { metalink, options } = data
    return api.addMetalink({ metalink, options })
      .then(() => {
        dispatch('fetchList')
        dispatch('app/updateAddTaskOptions', {}, { root: true })
      })
  },
  getTaskOption (_, gid) {
    return new Promise((resolve) => {
      api.getOption({ gid })
        .then((data) => {
          resolve(data)
        })
    })
  },
  changeTaskOption (_, payload) {
    const { gid, options } = payload
    return api.changeOption({ gid, options })
  },
  removeTask ({ state, dispatch }, task) {
    const { gid } = task
    if (gid === state.currentTaskGid) {
      dispatch('hideTaskDetail')
    }

    return api.removeTask({ gid })
      .finally(() => {
        dispatch('fetchList')
        dispatch('saveSession')
      })
  },
  forcePauseTask ({ dispatch }, task) {
    const { gid, status } = task
    if (status !== TASK_STATUS.ACTIVE) {
      return Promise.resolve(true)
    }

    return api.forcePauseTask({ gid })
      .finally(() => {
        dispatch('fetchList')
        dispatch('saveSession')
      })
  },
  pauseTask ({ dispatch }, task) {
    const { gid } = task
    const isBT = checkTaskIsBT(task)
    const promise = isBT ? api.forcePauseTask({ gid }) : api.pauseTask({ gid })
    promise.finally(() => {
      dispatch('fetchList')
      dispatch('saveSession')
    })
    return promise
  },
  resumeTask ({ dispatch }, task) {
    const { gid } = task
    return api.resumeTask({ gid })
      .finally(() => {
        dispatch('fetchList')
        dispatch('saveSession')
      })
  },
  pauseAllTask ({ dispatch }) {
    return api.pauseAllTask()
      .catch(() => {
        return api.forcePauseAllTask()
      })
      .then(() => {
        // 立即获取任务列表和全局统计以加快UI更新
        return Promise.all([
          dispatch('fetchList').catch(err => {
            console.error('[Motrix] pauseAllTask: fetchList failed', err)
          }),
          dispatch('app/fetchGlobalStat', {}, { root: true }).catch(err => {
            console.error('[Motrix] pauseAllTask: fetchGlobalStat failed', err)
          })
        ])
      })
      .finally(() => {
        dispatch('saveSession')
      })
  },
  resumeAllTask ({ dispatch }) {
    return api.resumeAllTask()
      .then(() => {
        // 立即获取任务列表和全局统计以加快UI更新
        return Promise.all([
          dispatch('fetchList').catch(err => {
            console.error('[Motrix] resumeAllTask: fetchList failed', err)
          }),
          dispatch('app/fetchGlobalStat', {}, { root: true }).catch(err => {
            console.error('[Motrix] resumeAllTask: fetchGlobalStat failed', err)
          })
        ])
      })
      .finally(() => {
        dispatch('saveSession')
      })
  },
  updateMagnetStatus ({ commit }, payload) {
    commit('UPDATE_MAGNET_STATUS', payload)
  },
  clearMagnetStatus ({ commit }, gid) {
    commit('CLEAR_MAGNET_STATUS', gid)
  },
  addToSeedingList ({ state, commit }, gid) {
    const { seedingList } = state
    if (seedingList.includes(gid)) {
      return
    }

    const list = [
      ...seedingList,
      gid
    ]
    commit('UPDATE_SEEDING_LIST', list)
  },
  removeFromSeedingList ({ state, commit }, gid) {
    const { seedingList } = state
    const idx = seedingList.indexOf(gid)
    if (idx === -1) {
      return
    }

    const list = [...seedingList.slice(0, idx), ...seedingList.slice(idx + 1)]
    commit('UPDATE_SEEDING_LIST', list)
  },
  stopSeeding ({ dispatch }, { gid }) {
    const options = {
      seedTime: 0
    }
    return dispatch('changeTaskOption', { gid, options })
  },
  removeTaskRecord ({ state, dispatch }, task) {
    const { gid, status } = task
    if (gid === state.currentTaskGid) {
      dispatch('hideTaskDetail')
    }

    const { ERROR, COMPLETE, REMOVED } = TASK_STATUS
    if ([ERROR, COMPLETE, REMOVED].indexOf(status) === -1) {
      return
    }
    return api.removeTaskRecord({ gid })
      .finally(() => dispatch('fetchList'))
  },
  saveSession () {
    api.saveSession()
  },
  purgeTaskRecord ({ dispatch }) {
    return api.purgeTaskRecord()
      .finally(() => dispatch('fetchList'))
  },
  toggleTask ({ dispatch }, task) {
    const { status } = task
    const { ACTIVE, WAITING, PAUSED } = TASK_STATUS
    if (status === ACTIVE) {
      return dispatch('pauseTask', task)
    } else if (status === WAITING || status === PAUSED) {
      return dispatch('resumeTask', task)
    }
  },
  batchResumeSelectedTasks ({ state }) {
    const gids = state.selectedGidList
    if (gids.length === 0) {
      return
    }

    return api.batchResumeTask({ gids })
  },
  batchPauseSelectedTasks ({ state }) {
    const gids = state.selectedGidList
    if (gids.length === 0) {
      return
    }

    return api.batchPauseTask({ gids })
  },
  batchForcePauseTask (_, gids) {
    return api.batchForcePauseTask({ gids })
  },
  batchResumeTask (_, gids) {
    return api.batchResumeTask({ gids })
  },
  batchRemoveTask ({ dispatch }, gids) {
    return api.batchRemoveTask({ gids })
      .finally(() => {
        dispatch('fetchList')
        dispatch('saveSession')
      })
  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
}
