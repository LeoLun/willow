import { markRaw, shallowRef, type Component } from "vue";

export interface DialogState {
  component: Component;
  props?: Record<string, unknown>;
  open: boolean;
  contentClass?: string;
}

const dialogState = shallowRef<DialogState | null>(null);

export function useDialog() {
  function openDialog(
    component: Component,
    props?: Record<string, unknown>,
    options?: { contentClass?: string },
  ) {
    dialogState.value = {
      component: markRaw(component),
      props: props ?? {},
      open: true,
      contentClass: options?.contentClass,
    };
  }

  function closeDialog() {
    if (dialogState.value) {
      dialogState.value = { ...dialogState.value, open: false };
    }
  }

  return { dialogState, openDialog, closeDialog };
}
