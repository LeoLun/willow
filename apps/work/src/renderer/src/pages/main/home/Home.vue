<script setup lang="ts">
import { SquareDashed } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
</script>

<template>
  <div class="flex min-h-full flex-col items-center justify-center">
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
  </div>
</template>
