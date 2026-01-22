import { AppEvent, AppState } from "../domain/state.js"

export class AppStore {
  private state: AppState
  private listeners: Set<(state: AppState) => void> = new Set()

  constructor(initialState: AppState) {
    this.state = initialState
  }

  getState() {
    return this.state
  }

  dispatch(event: AppEvent) {
    console.log(`[AppStore] Dispatching event: ${event.type}`)
    // We would use the reducer here in a full implementation
    this.notify()
  }

  subscribe(listener: (state: AppState) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.listeners.forEach(l => l(this.state))
  }
}
