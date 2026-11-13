/**
 * An error we write to be shown to the user. The IPC layer (ipc.ts → forRenderer) passes only this class's
 * and LlmError's messages to the UI; every other error goes to the log and the UI sees a generic message.
 */
export class UserError extends Error {}
