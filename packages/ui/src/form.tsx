import type { ComponentProps, JSX } from "@solidjs/web";
import { createContext, createEffect, createUniqueId, flush, omit, Show, useContext } from "solid-js";
import { cx } from "./utils";

export type ControlSize = "sm" | "md" | "lg";

interface ControlOptions {
  size?: ControlSize;
  invalid?: boolean;
}

export interface FieldContextValue {
  controlId: string;
  describedBy?: string | undefined;
  invalid?: boolean;
  required?: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

interface TextControlOptions extends ControlOptions {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export type InputProps = ComponentProps<"input"> & TextControlOptions;

const TYPED_INPUT_TYPES = new Set<string>(["text", "search", "email", "url", "tel", "number"]);
const CARET_NAVIGATION_KEYS = new Set<string>(["ArrowLeft", "ArrowRight", "Home", "End"]);

function callEventHandler<E extends Event, T extends HTMLElement>(
  handler: JSX.EventHandlerUnion<T, E> | undefined,
  event: E & { currentTarget: T; target: Element },
): void {
  if (!handler) return;
  if (typeof handler === "function") handler(event);
  else if (Array.isArray(handler)) handler[0](handler[1], event);
}

export function Input(props: InputProps): JSX.Element {
  const local = props;
  const field = useContext(FieldContext);
  const inputProps = omit(
    props,
    "class",
    "size",
    "invalid",
    "id",
    "aria-label",
    "aria-labelledby",
    "aria-describedby",
    "aria-invalid",
    "required",
    "onValueChange",
    "onInput",
    "onCompositionStart",
    "onCompositionEnd",
    "onKeyDown",
    "ref",
    "value",
    "defaultValue",
  );
  const describedBy = () => [local["aria-describedby"], field?.describedBy].filter(Boolean).join(" ") || undefined;
  const typeCue = () => {
    const type = local.type;
    return type === undefined || (typeof type === "string" && TYPED_INPUT_TYPES.has(type)) ? "" : undefined;
  };
  const selectCue = () => (local.type === "radio" ? "" : undefined);

  let elRef: HTMLInputElement | undefined;
  let composing = false;

  const setRef = (el: HTMLInputElement) => {
    elRef = el;
    if ("value" in props) {
      const initial = local.value ?? "";
      if (el.value !== initial) el.value = initial;
    }
    if (typeof local.ref === "function") local.ref(el);
  };

  createEffect(
    () => ("value" in props ? (local.value ?? "") : null),
    (next) => {
      if (next !== null && elRef && !composing && elRef.value !== next) {
        elRef.value = next;
      }
    },
  );

  const handleKeyDown: JSX.EventHandler<HTMLInputElement, KeyboardEvent> = (event) => {
    callEventHandler(local.onKeyDown, event);
    if (!event.defaultPrevented && CARET_NAVIGATION_KEYS.has(event.key)) {
      event.stopPropagation();
    }
  };

  if (!("value" in props)) {
    return (
      <input
        ref={setRef}
        data-cuelume-type={typeCue()}
        data-cuelume-select={selectCue()}
        {...inputProps}
        defaultValue={local.defaultValue}
        class={cx("ui-input", local.class)}
        data-size={local.size ?? "md"}
        id={local.id ?? field?.controlId}
        aria-label={local["aria-label"]}
        aria-labelledby={local["aria-labelledby"]}
        aria-describedby={describedBy()}
        aria-invalid={local["aria-invalid"] ?? (local.invalid || field?.invalid ? "true" : undefined)}
        required={local.required ?? field?.required}
        onKeyDown={handleKeyDown}
        onInput={
          local.onValueChange ? (event) => flush(() => local.onValueChange?.(event.currentTarget.value)) : local.onInput
        }
      />
    );
  }
  return (
    <input
      ref={setRef}
      data-cuelume-type={typeCue()}
      data-cuelume-select={selectCue()}
      {...inputProps}
      class={cx("ui-input", local.class)}
      data-size={local.size ?? "md"}
      id={local.id ?? field?.controlId}
      aria-label={local["aria-label"]}
      aria-labelledby={local["aria-labelledby"]}
      aria-describedby={describedBy()}
      aria-invalid={local["aria-invalid"] ?? (local.invalid || field?.invalid ? "true" : undefined)}
      required={local.required ?? field?.required}
      onKeyDown={handleKeyDown}
      onCompositionStart={(event) => {
        composing = true;
        callEventHandler(local.onCompositionStart, event);
      }}
      onCompositionEnd={(event) => {
        composing = false;
        callEventHandler(local.onCompositionEnd, event);
        if (local.onValueChange) {
          flush(() => local.onValueChange?.(event.currentTarget.value));
        }
      }}
      onInput={
        local.onValueChange
          ? (event) => {
              if (!composing) flush(() => local.onValueChange?.(event.currentTarget.value));
            }
          : local.onInput
      }
    />
  );
}

export type TextareaProps = ComponentProps<"textarea"> & TextControlOptions;

export function Textarea(props: TextareaProps): JSX.Element {
  const local = props;
  const field = useContext(FieldContext);
  const textareaProps = omit(
    props,
    "class",
    "size",
    "invalid",
    "id",
    "aria-label",
    "aria-labelledby",
    "aria-describedby",
    "aria-invalid",
    "required",
    "onValueChange",
    "onInput",
    "onCompositionStart",
    "onCompositionEnd",
    "onKeyDown",
    "ref",
    "value",
    "defaultValue",
  );
  const describedBy = () => [local["aria-describedby"], field?.describedBy].filter(Boolean).join(" ") || undefined;

  let elRef: HTMLTextAreaElement | undefined;
  let composing = false;

  const setRef = (el: HTMLTextAreaElement) => {
    elRef = el;
    if ("value" in props) {
      const initial = local.value ?? "";
      if (el.value !== initial) el.value = initial;
    }
    if (typeof local.ref === "function") local.ref(el);
  };

  createEffect(
    () => ("value" in props ? (local.value ?? "") : null),
    (next) => {
      if (next !== null && elRef && !composing && elRef.value !== next) {
        elRef.value = next;
      }
    },
  );

  const handleKeyDown: JSX.EventHandler<HTMLTextAreaElement, KeyboardEvent> = (event) => {
    callEventHandler(local.onKeyDown, event);
    if (!event.defaultPrevented && CARET_NAVIGATION_KEYS.has(event.key)) {
      event.stopPropagation();
    }
  };

  if (!("value" in props)) {
    return (
      <textarea
        ref={setRef}
        data-cuelume-type=""
        {...textareaProps}
        defaultValue={local.defaultValue}
        class={cx("ui-textarea", local.class)}
        data-size={local.size ?? "md"}
        id={local.id ?? field?.controlId}
        aria-label={local["aria-label"]}
        aria-labelledby={local["aria-labelledby"]}
        aria-describedby={describedBy()}
        aria-invalid={local["aria-invalid"] ?? (local.invalid || field?.invalid ? "true" : undefined)}
        required={local.required ?? field?.required}
        onKeyDown={handleKeyDown}
        onInput={
          local.onValueChange ? (event) => flush(() => local.onValueChange?.(event.currentTarget.value)) : local.onInput
        }
      />
    );
  }
  return (
    <textarea
      ref={setRef}
      data-cuelume-type=""
      {...textareaProps}
      class={cx("ui-textarea", local.class)}
      data-size={local.size ?? "md"}
      id={local.id ?? field?.controlId}
      aria-label={local["aria-label"]}
      aria-labelledby={local["aria-labelledby"]}
      aria-describedby={describedBy()}
      aria-invalid={local["aria-invalid"] ?? (local.invalid || field?.invalid ? "true" : undefined)}
      required={local.required ?? field?.required}
      onKeyDown={handleKeyDown}
      onCompositionStart={(event) => {
        composing = true;
        callEventHandler(local.onCompositionStart, event);
      }}
      onCompositionEnd={(event) => {
        composing = false;
        callEventHandler(local.onCompositionEnd, event);
        if (local.onValueChange) {
          flush(() => local.onValueChange?.(event.currentTarget.value));
        }
      }}
      onInput={
        local.onValueChange
          ? (event) => {
              if (!composing) flush(() => local.onValueChange?.(event.currentTarget.value));
            }
          : local.onInput
      }
    />
  );
}

export type NativeSelectProps = ComponentProps<"select"> & ControlOptions;

export function NativeSelect(props: NativeSelectProps): JSX.Element {
  const local = props;
  const field = useContext(FieldContext);
  const others = omit(props, "class", "size", "invalid", "id", "aria-describedby", "aria-invalid", "required");
  const describedBy = () => [local["aria-describedby"], field?.describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <select
      data-cuelume-select=""
      {...others}
      class={cx("ui-native-select", local.class)}
      data-size={local.size ?? "md"}
      id={local.id ?? field?.controlId}
      aria-describedby={describedBy()}
      aria-invalid={local["aria-invalid"] ?? (local.invalid || field?.invalid ? "true" : undefined)}
      required={local.required ?? field?.required}
    />
  );
}

export function Label(props: ComponentProps<"label">): JSX.Element {
  const local = props;
  const field = useContext(FieldContext);
  const others = omit(props, "class", "children", "for");
  return (
    <label class={cx("ui-label", local.class)} for={local.for ?? field?.controlId} {...others}>
      {local.children}
    </label>
  );
}

export interface FieldProps extends JSX.HTMLAttributes<HTMLDivElement> {
  label: JSX.Element;
  description?: JSX.Element;
  error?: JSX.Element;
  required?: boolean;
  htmlFor?: string;
}

export function Field(props: FieldProps): JSX.Element {
  const generatedId = createUniqueId();
  const local = props;
  const others = omit(props, "class", "children", "label", "description", "error", "required", "htmlFor");
  const descriptionId = `${generatedId}-description`;
  const errorId = `${generatedId}-error`;
  const fieldValue: FieldContextValue = {
    controlId: local.htmlFor ?? `${generatedId}-control`,
    get describedBy() {
      return local.error ? errorId : local.description ? descriptionId : undefined;
    },
    get invalid() {
      return Boolean(local.error);
    },
    get required() {
      return Boolean(local.required);
    },
  };
  return (
    <FieldContext value={fieldValue}>
      <div class={cx("ui-field", local.class)} data-invalid={local.error ? "" : undefined} {...others}>
        <Label>
          {local.label}
          <Show when={local.required}>
            <span class="ui-field-required" aria-hidden="true">
              *
            </span>
          </Show>
        </Label>
        {local.children}
        <Show when={local.description}>
          <div id={descriptionId} class="ui-field-description">
            {local.description}
          </div>
        </Show>
        <Show when={local.error}>
          <div id={errorId} class="ui-field-error" role="alert">
            {local.error}
          </div>
        </Show>
      </div>
    </FieldContext>
  );
}
