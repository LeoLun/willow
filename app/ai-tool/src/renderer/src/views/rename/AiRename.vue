<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { LoaderCircle, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-vue-next'
import RenameFilePicker from './RenameFilePicker.vue'
import { electronAPI } from '@/lib/ipc'

type SelectedFile = {
  file: File;
  filePath: string;
  fileName: string;
}

const selectedFile = ref<SelectedFile | null>(null)
const loading = ref(false)
const applying = ref(false)
const error = ref('')
const success = ref('')

const recommendations = ref<string[]>([])
const selectedIndex = ref(0)

const ext = computed(() => {
  const name = selectedFile.value?.fileName || ''
  const i = name.lastIndexOf('.')
  return i > -1 ? name.slice(i) : ''
})

const selectedBaseName = computed(() => {
  return recommendations.value[selectedIndex.value] || ''
})

const previewFileName = computed(() => {
  if (!selectedBaseName.value) return ''
  return `${selectedBaseName.value}${ext.value}`
})

const onSelected = (payload: SelectedFile) => {
  selectedFile.value = payload
  error.value = ''
  success.value = ''
  recommendations.value = []
  selectedIndex.value = 0
}

const fetchRecommend = async () => {
  if (!selectedFile.value?.filePath) return
  loading.value = true
  error.value = ''
  success.value = ''
  recommendations.value = []
  selectedIndex.value = 0
  try {
    const rsp = await electronAPI.aiRenameRecommend({ filePath: selectedFile.value.filePath })
    if (rsp.result === 'success') {
      recommendations.value = (rsp.recommendations || []).slice(0, 3)
      selectedIndex.value = 0 // 默认选最优（第一个）
    } else {
      error.value = (rsp as any).error || 'AI 推荐失败'
    }
  } catch (e: any) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

const applyRename = async () => {
  if (!selectedFile.value?.filePath) return
  if (!selectedBaseName.value) return
  applying.value = true
  error.value = ''
  success.value = ''
  try {
    const rsp = await electronAPI.aiRenameApply({
      filePath: selectedFile.value.filePath,
      newBaseName: selectedBaseName.value,
    })
    if (rsp.result === 'success') {
      success.value = `重命名成功：${rsp.newPath}`
      // 更新页面展示路径与文件名（不依赖 fs 再读）
      const newName = previewFileName.value || selectedFile.value.fileName
      selectedFile.value = {
        ...selectedFile.value,
        filePath: rsp.newPath,
        fileName: newName,
      }
    } else {
      error.value = rsp.error || '重命名失败'
    }
  } catch (e: any) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <div class="flex flex-col w-full h-full items-center">
    <div class="flex flex-col w-10/12 h-full pt-8 pb-8 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>AI 重命名</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <div class="text-sm text-muted-foreground">
            选择一个文件，AI 将给出 3 个推荐名字（最优推荐会高亮并默认选中）。
          </div>
          <RenameFilePicker @selected="onSelected" />
        </CardContent>
      </Card>

      <Card v-if="selectedFile">
        <CardContent class="py-4 flex flex-col gap-3">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="text-sm text-muted-foreground">已选择文件</div>
              <div class="font-medium truncate">{{ selectedFile.fileName }}</div>
              <div class="text-xs text-muted-foreground truncate" :title="selectedFile.filePath">
                {{ selectedFile.filePath }}
              </div>
            </div>
            <div class="shrink-0 flex items-center gap-2">
              <Button @click="fetchRecommend" :disabled="loading || applying">
                <LoaderCircle v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
                <Sparkles v-else class="mr-2 h-4 w-4" />
                AI 推荐
              </Button>
            </div>
          </div>

          <Separator />

          <div v-if="error" class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm border-destructive/20 bg-destructive/10 text-destructive">
            <AlertTriangle class="h-4 w-4" />
            <span class="truncate" :title="error">{{ error }}</span>
          </div>
          <div v-if="success" class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 class="h-4 w-4" />
            <span class="truncate" :title="success">{{ success }}</span>
          </div>

          <div v-if="recommendations.length" class="flex flex-col gap-2">
            <div class="text-sm font-medium">推荐名称</div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                v-for="(name, idx) in recommendations"
                :key="name + idx"
                type="button"
                class="text-left rounded-md border px-3 py-3 transition-colors hover:bg-muted/40"
                :class="[
                  selectedIndex === idx ? 'border-primary bg-primary/5' : 'border-border bg-background',
                  idx === 0 ? 'ring-1 ring-emerald-500/30' : ''
                ].filter(Boolean).join(' ')"
                @click="selectedIndex = idx"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="font-medium truncate" :title="name">{{ name }}</div>
                  <span v-if="idx === 0" class="text-xs text-emerald-600 dark:text-emerald-400 shrink-0">最优推荐</span>
                </div>
                <div class="text-xs text-muted-foreground mt-1 truncate" :title="previewFileName">
                  预览：{{ name }}{{ ext }}
                </div>
              </button>
            </div>

            <div class="mt-2 flex items-center justify-between gap-3 flex-wrap">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-sm text-muted-foreground whitespace-nowrap">将重命名为</span>
                <Input class="max-w-[360px]" :model-value="previewFileName" disabled />
              </div>
              <Button @click="applyRename" :disabled="applying || loading || !selectedBaseName">
                <LoaderCircle v-if="applying" class="mr-2 h-4 w-4 animate-spin" />
                执行重命名
              </Button>
            </div>
          </div>

          <div v-else class="text-sm text-muted-foreground">
            点击“AI 推荐”生成候选名称。
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>


