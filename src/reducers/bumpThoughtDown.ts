import _ from 'lodash'
import { editThought, moveThought, createThought, setCursor, subCategorizeOne, editableRender } from '../reducers'
import { getPrevRank, getRankBefore, getAllChildren, simplifyPath, rootedParentOf } from '../selectors'
import { appendToPath, parentOf, headValue, pathToContext, reducerFlow } from '../util'
import { Path, SimplePath, State } from '../@types'

/** Clears a thought's text, moving it to its first child. */
const bumpThoughtDown = (state: State, { simplePath }: { simplePath?: SimplePath }): State => {
  if (!simplePath && !state.cursor) return state

  simplePath = simplePath || simplifyPath(state, state.cursor!)
  const value = headValue(simplePath)

  // const rank = headRank(simplePath)
  const context = pathToContext(simplePath)
  const children = getAllChildren(state, context)

  // if there are no children
  if (children.length === 0) return subCategorizeOne(state)

  // TODO: Resolve simplePath to make it work within the context view
  // Cannot do this without the contextChain
  // Need to store the full simplePath of each simplePath segment in the simplePath
  const parentPath = parentOf(simplePath)

  // modify the rank to get the thought to re-render (via the Subthoughts child key)
  // this should be fixed
  const simplePathWithNewRank: SimplePath = appendToPath(parentPath, { value, rank: getRankBefore(state, simplePath) })
  const simplePathWithNewRankAndValue: Path = appendToPath(parentPath, {
    value: '',
    rank: getRankBefore(state, simplePath),
  })

  return reducerFlow([
    // modify the rank to get the thought to re-render (via the Subthoughts child key)
    moveThought({
      oldPath: simplePath,
      newPath: simplePathWithNewRank,
    }),

    // new thought
    state => {
      // the context of the new empty thought
      const contextEmpty = pathToContext(simplePath as Path)
      return createThought(state, {
        context: contextEmpty,
        rank: getPrevRank(state, contextEmpty),
        value,
      })
    },

    // clear text
    editThought({
      oldValue: value,
      newValue: '',
      context: rootedParentOf(state, context),
      path: simplePathWithNewRank,
    }),

    // set cursor
    setCursor({
      path: simplePathWithNewRankAndValue,
    }),
    editableRender,
  ])(state)
}

export default _.curryRight(bumpThoughtDown)
