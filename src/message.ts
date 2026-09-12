// A small convenience over Optique's messages.

import type { Message } from "@optique/core/message"

/**
 * Folds the indentation of a wrapped `message` template back into single
 * spaces, so that a description written across several source lines reads as
 * one paragraph in the help.
 */
export function tidy(message: Message): Message {
    return message.map((term) =>
        term.type === "text"
            ? { ...term, text: term.text.replace(/\s+/g, " ") }
            : term
    )
}
