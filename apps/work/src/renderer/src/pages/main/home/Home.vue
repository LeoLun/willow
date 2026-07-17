<script setup lang="ts">
import {
  InputGroup,
  InputGroupTextarea,
  InputGroupText,
  InputGroupAddon,
  InputGroupButton,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Separator,
} from "@willow/shadcn";
import { SquareDashed, PlusIcon, ArrowUpIcon } from "lucide-vue-next";
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

const message = ref("");

function sendMessage() {
  console.log(message.value);
}
</script>

<template>
  <div class="flex min-h-full flex-col items-center justify-center p-8">
    <div class="max-w-sm text-center">
      <p class="text-sm font-medium text-foreground">Text Edit</p>
      <p class="mt-1 text-sm text-muted-foreground">
        Select an item from the sidebar to start exploring.
      </p>
      <div class="mt-2 flex flex-col items-center">
        <div class="flex items-center gap-1">
          <Button shape="circular" aria-label="Action">
            <SquareDashed />
          </Button>
          <Button shape="capsule" aria-label="Action">
            <SquareDashed />
          </Button>
          <Button variant="borderless" shape="capsule">
            <SquareDashed />
          </Button>

          <ButtonGroup shape="capsule" aria-label="Actions">
            <Button aria-label="First">
              <SquareDashed />
            </Button>
            <Button aria-label="Second">
              <SquareDashed />
            </Button>
            <Button aria-label="Third">
              <SquareDashed />
            </Button>
          </ButtonGroup>
        </div>

        <ButtonGroup shape="circular" aria-label="Actions">
          <Button aria-label="First">
            <SquareDashed />
          </Button>
          <Button aria-label="Second">
            <SquareDashed />
          </Button>
          <Button aria-label="Third">
            <SquareDashed />
          </Button>
        </ButtonGroup>
      </div>
    </div>
    <InputGroup>
      <InputGroupTextarea placeholder="Ask, Search or Chat..." v-model="message" />
      <InputGroupAddon align="block-end">
        <InputGroupButton variant="outline" class="rounded-full" size="icon-xs">
          <PlusIcon class="size-4" />
        </InputGroupButton>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <InputGroupButton variant="ghost"> Auto </InputGroupButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" class="[--radius:0.95rem]">
            <DropdownMenuItem>Auto</DropdownMenuItem>
            <DropdownMenuItem>Agent</DropdownMenuItem>
            <DropdownMenuItem>Manual</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <InputGroupText class="ml-auto"> 52% used </InputGroupText>
        <Separator orientation="vertical" class="!h-4" />
        <InputGroupButton
          variant="default"
          class="rounded-full"
          size="icon-xs"
          :disabled="!message"
          @click="sendMessage"
        >
          <ArrowUpIcon class="size-4" />
          <span class="sr-only">Send</span>
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  </div>
</template>
