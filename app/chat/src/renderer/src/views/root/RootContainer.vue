<script setup lang="ts">
import {
  Card,
  CardContent
} from '@/components/ui/card'
</script>
<template>
  <div class="flex flex-1 flex-col p-4 pl-0 w-full h-full">
    <Card class="w-full h-full bg-background">
      <CardContent class="w-full h-full p-0">
        <router-view />
      </CardContent>
    </Card>
  </div>
</template>
