// constants
import {
  MIN_LINE_HEIGHT,
  RANKED_ROOT,
} from '../constants'

// util
import {
  contextOf,
  head,
  headValue,
  isDivider,
  isRoot,
  pathToContext,
  rootedContextOf,
  unroot,
} from '../util'

// selectors
import { prevSibling } from '../selectors'

export default () => (dispatch, getState) => {
  const state = getState()
  const { cursor } = state
  const thoughtsRanked = cursor || RANKED_ROOT
  const { value, rank } = head(thoughtsRanked)
  const contextRanked = rootedContextOf(thoughtsRanked)
  const context = pathToContext(contextRanked)

  const thoughtBefore = prevSibling(state, value, context, rank)
  const thoughtsRankedBefore = thoughtBefore && unroot(contextOf(thoughtsRanked).concat(thoughtBefore))
  // const prevNieces = thoughtBefore && getThoughtsRanked(thoughtsRankedBefore)
  // const prevNiece = prevNieces && prevNieces[prevNieces.length - 1]

  // TODO: Select deepest previous sibling's descendant (not just previous niece)

  const prevThoughtsRanked =
    // select prev sibling
    thoughtBefore ? thoughtsRankedBefore
    // select parent
    : !isRoot(context) ? contextRanked
    // previous niece
    // prevNiece ? unroot(thoughtsRankedBefore.concat(prevNiece))
    : null // see TODO

  const { baseNode } = window.getSelection()
  const isMultiLineField = baseNode && baseNode.parentElement.closest('li').previousSibling.clientHeight > MIN_LINE_HEIGHT

  if (prevThoughtsRanked) {
    dispatch({
      type: 'setCursor',
      thoughtsRanked: prevThoughtsRanked,
      offset: isMultiLineField ? prevThoughtsRanked[prevThoughtsRanked.length - 1].value.length : 0,
    })

    // if we are selecting a divider, remove browser selection from the previous thought
    if (isDivider(headValue(prevThoughtsRanked))) {
      document.getSelection().removeAllRanges()
    }
  }
}
