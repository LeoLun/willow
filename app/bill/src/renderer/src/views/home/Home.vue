<script setup lang="ts">
import {
  Card,
  CardContent
} from '@/components/ui/card'
</script>
<template>
  <div>
    <h2>1 月 20 日</h2>

    <h3>早上好</h3>
  </div>
  <div class="flex flex-1 flex-col gap-4">
    <div class="grid auto-rows-min gap-4 md:grid-cols-2">
      <Card class="aspect-[21/9] rounded-xl">
        <CardContent>1</CardContent>
      </Card>
      <div class="grid auto-rows-min gap-4 md:grid-cols-2">
        <Card class="aspect-[21/9] rounded-xl">
          <CardContent>2</CardContent>
        </Card>
        <Card class="aspect-[21/9] rounded-xl">
          <CardContent>2</CardContent>
        </Card>
        <Card class="aspect-[21/9] rounded-xl">
          <CardContent>2</CardContent>
        </Card>
        <Card class="aspect-[21/9] rounded-xl">
          <CardContent>2</CardContent>
        </Card>
      </div>
    </div>
    <div class="flex-1 rounded-xl bg-muted/50" >
      首页
    </div>
  </div>
</template>