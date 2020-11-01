import { store } from '../../store'
import createTestApp, { cleanupTestApp } from '../../test-helpers/createTestApp'
import NewThoughtInstructions from '../NewThoughtInstructions'
import { importText } from '../../reducers'
import { RANKED_ROOT } from '../../constants'

let wrapper = null // eslint-disable-line fp/no-let

beforeEach(async () => {
  wrapper = await createTestApp()
})

afterEach(async () => {
  await cleanupTestApp()
})

it('show NewThoughtInstructions when there are no visible thoughts in the root context', async () => {

  // NewThoughtInstructions should be visible when there are no thoughts
  expect(wrapper.find(NewThoughtInstructions)).toHaveLength(1)

  store.dispatch({
    type: 'importText',
    path: RANKED_ROOT,
    text: `
      - a
      - b
      - =test
    `
  })

  wrapper.update()

  // NewThoughtInstructions should not be visible when there is at least one visible thought
  expect(wrapper.find(NewThoughtInstructions)).toHaveLength(0)

  store.dispatch({
    type: 'deleteThought',
    path: [{ value: 'a', rank: 0 }]
  })

  // still has one visible thought
  expect(wrapper.find(NewThoughtInstructions)).toHaveLength(0)

  store.dispatch({
    type: 'deleteThought',
    path: [{ value: 'b', rank: 1 }]
  })

  wrapper.update()

  // There are no visible thoughts
  expect(wrapper.find(NewThoughtInstructions)).toHaveLength(1)

})
