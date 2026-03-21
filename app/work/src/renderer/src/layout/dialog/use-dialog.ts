import { ref, type Component } from "vue";

export interface DialogState {
  component: Component;
  props?: Record<string, unknown>;
  open: boolean;
}

const dialogState = ref<DialogState | null>(null);

export function useDialog() {
  function openDialog(component: Component, props?: Record<string, unknown>) {
    dialogState.value = { component, props: props ?? {}, open: true };
  }

  function closeDialog() {
    if (dialogState.value) {
      dialogState.value.open = false;
    }
  }

  return { dialogState, openDialog, closeDialog };
}
