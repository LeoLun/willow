<script setup lang="ts">
import { useDialog } from "./use-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const { dialogState, closeDialog } = useDialog();
</script>

<template>
  <Dialog
    v-if="dialogState"
    :open="dialogState.open"
    @update:open="(val: boolean) => { if (!val) closeDialog(); }"
  >
    <DialogContent>
      <component
        :is="dialogState.component"
        v-bind="dialogState.props"
        @close="closeDialog"
      />
    </DialogContent>
  </Dialog>
</template>
