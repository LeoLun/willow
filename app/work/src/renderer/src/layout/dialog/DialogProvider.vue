<script setup lang="ts">
import { Dialog, DialogContent } from "@willow/shadcn/components/ui/dialog";
import { useDialog } from "./use-dialog";

const { dialogState, closeDialog } = useDialog();
</script>

<template>
  <Dialog
    v-if="dialogState"
    :open="dialogState.open"
    @update:open="
      (val: boolean) => {
        if (!val) closeDialog();
      }
    "
  >
    <DialogContent>
      <component :is="dialogState.component" v-bind="dialogState.props" @close="closeDialog" />
    </DialogContent>
  </Dialog>
</template>
