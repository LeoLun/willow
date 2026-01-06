<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import FileUpload from "./FileUpload.vue"
import UploadStepper from "./UploadStepper.vue"
import BillList from "./BillList.vue"
import { electronAPI } from "@/lib/ipc"
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, CheckCircle2, LoaderCircle, Sparkles } from 'lucide-vue-next'

type SelectedFile = {
  file: File;
  filePath: string;
  fileName: string;
}

const stepIndex = ref(1)
const selectedFile = ref<SelectedFile | null>(null)
const billList = ref<any[]>([])
const jobId = ref<string>('')

const parsing = ref(false)
const classifying = ref(false)
const classifyDone = ref(false)
const uploading = ref(false)
const error = ref<string>('')
const success = ref<string>('')

const totalCount = computed(() => billList.value?.length ?? 0)
const aiDoneCount = computed(() => {
  const list = billList.value ?? []
  return list.filter((b: any) => b?.category && b.category !== 'wait' && b.category !== 'start').length
})
const aiProgressText = computed(() => {
  if (!totalCount.value) return ''
  return `AI 解析进度：${aiDoneCount.value}/${totalCount.value}`
})
const aiPercent = computed(() => {
  if (!totalCount.value) return 0
  return Math.round((aiDoneCount.value / totalCount.value) * 100)
})

const uploadProgress = ref<{ current: number; total: number; uploaded: number; skipped: number } | null>(null)
const uploadProgressText = computed(() => {
  if (!uploadProgress.value) return ''
  const p = uploadProgress.value
  return `上传进度：${p.current}/${p.total}（成功 ${p.uploaded}，跳过 ${p.skipped}）`
})
const uploadPercent = computed(() => {
  const p = uploadProgress.value
  if (!p?.total) return 0
  return Math.round((p.current / p.total) * 100)
})

const overallState = computed<'error' | 'success' | 'running' | 'idle'>(() => {
  if (error.value) return 'error'
  if (success.value) return 'success'
  if (parsing.value || classifying.value || uploading.value) return 'running'
  return 'idle'
})
const overallText = computed(() => {
  if (error.value) return error.value
  if (success.value) return success.value
  if (parsing.value) return '正在解析文件...'
  if (classifying.value) return 'AI 正在解析分类...'
  if (uploading.value) return '正在上传到 Notion...'
  // 优先展示更有用的信息
  return uploadProgressText.value || aiProgressText.value || '等待操作'
})

const classifyStatusText = computed(() => {
  if (!jobId.value) return '未开始'
  if (classifying.value) return '解析中'
  if (classifyDone.value) return '已完成'
  return '待开始'
})
const uploadStatusText = computed(() => {
  if (!jobId.value) return '未开始'
  if (!classifyDone.value) return '未开始'
  if (uploading.value) return '上传中'
  if (success.value) return '已完成'
  return '待开始'
})

const AUTO_RUN_KEY = 'willow.upload.autoRun.v1'
const autoRun = ref(false)
try {
  const v = localStorage.getItem(AUTO_RUN_KEY)
  // 默认开启：仅当显式存储为 0 时关闭
  autoRun.value = v === null ? true : v === '1'
} catch (_) {
  autoRun.value = true
}

watch(autoRun, (v) => {
  try {
    localStorage.setItem(AUTO_RUN_KEY, v ? '1' : '0')
  } catch (_) {
    // ignore
  }
}, { flush: 'post' })

// 列表增强：自动定位 + 逐条状态
const activeAiBillId = ref<string>('')
const activeUploadBillId = ref<string>('')
const uploadStatusById = ref<Record<string, 'pending' | 'uploading' | 'uploaded' | 'skipped'>>({})

const canStartClassify = computed(() => !!jobId.value && !classifying.value && !classifyDone.value)
const canUpload = computed(() => !!jobId.value && classifyDone.value && !uploading.value)
const showManualActions = computed(() => !autoRun.value)

let autoRunSeq = 0
const maybeAutoRun = async () => {
  const seq = ++autoRunSeq
  if (!autoRun.value) return
  if (!jobId.value) return
  if (parsing.value) return
  if (error.value) return
  // 避免列表还没回推就开始 AI（体验更连贯）
  if (!totalCount.value) return

  // 优先 AI 分类
  if (!classifyDone.value) {
    if (canStartClassify.value) {
      await startClassify()
    }
    return
  }

  // 再上传
  if (canUpload.value) {
    await uploadBills()
  }

  // 防止并发调用导致的“后写覆盖前写”
  if (seq !== autoRunSeq) return
}

const resetFlow = () => {
  stepIndex.value = 1
  selectedFile.value = null
  billList.value = []
  jobId.value = ''
  parsing.value = false
  classifying.value = false
  classifyDone.value = false
  uploading.value = false
  uploadProgress.value = null
  activeAiBillId.value = ''
  activeUploadBillId.value = ''
  uploadStatusById.value = {}
  error.value = ''
  success.value = ''
}

const onSelected = (payload: SelectedFile) => {
  // 重新选择文件时，重置后续状态
  error.value = ''
  success.value = ''
  selectedFile.value = payload
  billList.value = []
  jobId.value = ''
  uploadProgress.value = null
  activeAiBillId.value = ''
  activeUploadBillId.value = ''
  uploadStatusById.value = {}
  parsing.value = true
  classifying.value = false
  classifyDone.value = false
  uploading.value = false

  // 选择文件后立刻解析出账单列表（不触发 AI、不上传）
  stepIndex.value = 2
  electronAPI.parseBillFile(payload.filePath)
    .then((rsp) => {
      if (rsp.result === 'success' && rsp.jobId) {
        jobId.value = rsp.jobId
      } else {
        error.value = rsp.error || '解析失败'
        stepIndex.value = 1
      }
    })
    .catch((e: any) => {
      error.value = e instanceof Error ? e.message : String(e)
      stepIndex.value = 1
    })
    .finally(() => {
      parsing.value = false
      void maybeAutoRun()
    })
}

const startClassify = async () => {
  if (!jobId.value || classifying.value || classifyDone.value) return
  classifying.value = true
  error.value = ''
  success.value = ''
  try {
    const rsp = await electronAPI.aiClassifyBill(jobId.value)
    if (rsp.result === 'success' && rsp.jobId) {
      jobId.value = rsp.jobId
      // 解析结果/更新进度靠事件回推；这里保持在 step2
      stepIndex.value = 2
    } else {
      classifying.value = false
      error.value = rsp.error || 'AI 分类失败'
    }
  } catch (e: any) {
    classifying.value = false
    error.value = e instanceof Error ? e.message : String(e)
  }
}

const uploadBills = async () => {
  if (!canUpload.value) return
  uploading.value = true
  error.value = ''
  success.value = ''
  uploadProgress.value = { current: 0, total: billList.value.length, uploaded: 0, skipped: 0 }
  activeUploadBillId.value = ''
  try {
    const rsp = await electronAPI.uploadBillToNotion(jobId.value)
    if (rsp.result === 'success') {
      success.value = `上传完成：成功 ${rsp.uploaded ?? 0} 条，已存在跳过 ${rsp.skipped ?? 0} 条`
    } else {
      error.value = rsp.error || '上传失败'
    }
  } catch (e: any) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    uploading.value = false
  }
}

// 监听文件解析结果
onMounted(() => {
  electronAPI.onParseBillResult((data) => {
    console.log('文件解析结果', data);
    billList.value = data;
    // 初始化每条上传状态
    const next: Record<string, 'pending' | 'uploading' | 'uploaded' | 'skipped'> = {}
    for (const b of (data as any[])) {
      if (b?.id) next[b.id] = 'pending'
    }
    uploadStatusById.value = next
    // 确保在 AI 分类步骤展示列表
    if (stepIndex.value < 2) stepIndex.value = 2
    void maybeAutoRun()
  });
  // 监听账单更新
  electronAPI.onUpdateBill((bill) => {
    // 找到更新的账单
    const index = billList.value.findIndex((item) => item.id === bill.id);
    if (index !== -1) {
      billList.value[index] = bill;
    }
    // AI 解析中：自动定位到当前解析的那条
    if (bill?.category === 'start') {
      activeAiBillId.value = bill.id
    } else if (bill?.id && activeAiBillId.value === bill.id) {
      // 解析完成/失败：还原背景颜色
      activeAiBillId.value = ''
    }
    console.log('账单更新', bill);
  });

  electronAPI.onAiClassifyDone((payload) => {
    // 只在当前 jobId 下推进步骤
    if (payload?.jobId && payload.jobId === jobId.value) {
      classifying.value = false
      classifyDone.value = true
      stepIndex.value = 3
      void maybeAutoRun()
    }
  })

  electronAPI.onUploadBillProgress((payload) => {
    if (!payload?.jobId || payload.jobId !== jobId.value) return
    uploadProgress.value = {
      current: payload.current,
      total: payload.total,
      uploaded: payload.uploaded,
      skipped: payload.skipped,
    }

    if (payload.billId) {
      const map = { ...(uploadStatusById.value || {}) }
      if (payload.stage === 'start') {
        // 上传中：高亮并定位
        activeUploadBillId.value = payload.billId
        map[payload.billId] = 'uploading'
      } else if (payload.stage === 'done') {
        map[payload.billId] = payload.action === 'uploaded' ? 'uploaded' : 'skipped'
        // 上传完成：还原背景颜色
        if (activeUploadBillId.value === payload.billId) activeUploadBillId.value = ''
      }
      uploadStatusById.value = map
    }
  })
});

watch([autoRun, () => jobId.value, () => classifyDone.value], () => {
  void maybeAutoRun()
}, { flush: 'post' })

</script>

<template>
  <div class="flex flex-col w-full h-full items-center">
    <div class="flex flex-col w-10/12 h-full pt-8 pb-8">
      <UploadStepper class="mt-16 mb-4" v-model="stepIndex" />
      <!-- 顶部状态条：常驻展示，不被列表滚动影响 -->
      <div v-if="stepIndex !== 1" class="mb-4">
        <Card>
          <CardContent class="py-3 flex flex-col gap-3">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="text-sm font-medium">进度</div>
                <div class="text-xs text-muted-foreground">
                  自动解析+上传：{{ autoRun ? '已开启' : '已关闭' }}
                </div>
              </div>
              <div
                class="shrink-0 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                :class="[
                  overallState === 'error' ? 'border-destructive/20 bg-destructive/10 text-destructive' : '',
                  overallState === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : '',
                  overallState === 'running' ? 'border-border bg-muted text-foreground' : '',
                  overallState === 'idle' ? 'border-border bg-background text-foreground' : '',
                ].filter(Boolean).join(' ')"
              >
                <AlertTriangle v-if="overallState === 'error'" class="h-4 w-4" />
                <CheckCircle2 v-else-if="overallState === 'success'" class="h-4 w-4" />
                <LoaderCircle v-else-if="overallState === 'running'" class="h-4 w-4 animate-spin" />
                <span class="max-w-[520px] truncate" :title="overallText">{{ overallText }}</span>
              </div>
            </div>

            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <div class="text-sm text-muted-foreground">已选择文件</div>
                <div class="font-medium truncate">
                  {{ selectedFile?.fileName || '未选择' }}
                </div>
                <div class="text-xs text-muted-foreground truncate" v-if="selectedFile?.filePath">
                  {{ selectedFile.filePath }}
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <Button variant="secondary" @click="resetFlow" :disabled="classifying || uploading">
                  重新选择
                </Button>

                <Button v-if="stepIndex === 2 && showManualActions" @click="startClassify" :disabled="!canStartClassify">
                  <LoaderCircle v-if="classifying" class="mr-2 h-4 w-4 animate-spin" />
                  <Sparkles v-else class="mr-2 h-4 w-4" />
                  AI 解析
                </Button>

                <Button v-if="stepIndex === 3 && showManualActions" @click="uploadBills" :disabled="!canUpload">
                  <LoaderCircle v-if="uploading" class="mr-2 h-4 w-4 animate-spin" />
                  上传账单
                </Button>
              </div>
            </div>

            <Separator />

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <div class="text-sm">AI 解析</div>
                  <div class="text-xs text-muted-foreground">
                    {{ classifyStatusText }}<span v-if="totalCount"> · {{ aiDoneCount }}/{{ totalCount }}（{{ aiPercent }}%）</span>
                  </div>
                </div>
                <Progress :value="aiDoneCount" :max="totalCount || 1" />
              </div>

              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <div class="text-sm whitespace-nowrap">
                    上传 <span class="text-muted-foreground">Notion</span>
                  </div>
                  <div class="text-xs text-muted-foreground flex flex-wrap justify-end gap-x-2 gap-y-0.5 text-right">
                    <span class="whitespace-nowrap">{{ uploadStatusText }}</span>
                    <span v-if="uploadProgress?.total" class="whitespace-nowrap">· {{ uploadProgress.current }}/{{ uploadProgress.total }}（{{ uploadPercent }}%）</span>
                    <span v-if="uploadProgress?.total" class="whitespace-nowrap">· 成功 {{ uploadProgress.uploaded }} / 跳过 {{ uploadProgress.skipped }}</span>
                  </div>
                </div>
                <Progress :value="uploadProgress?.current ?? 0" :max="uploadProgress?.total || 1" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <!-- 关键：滚动只发生在列表区域（flex-1 + min-h-0 + overflow-auto） -->
      <div class="flex flex-col items-center w-full h-full min-h-0">
        <template v-if="stepIndex === 1">
          <div class="w-full flex flex-col items-center gap-4">
            <Card class="w-full">
              <CardContent class="py-4 flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <div class="text-sm font-medium">自动解析+上传</div>
                  <div class="text-xs text-muted-foreground">
                    开启后，选择文件将自动执行“AI 解析 → 上传”
                  </div>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                  <span class="text-xs text-muted-foreground whitespace-nowrap">
                    {{ autoRun ? '已开启' : '已关闭' }}
                  </span>
                  <Switch v-model="autoRun" />
                </div>
              </CardContent>
            </Card>
            <FileUpload @selected="onSelected" />
          </div>
        </template>

        <template v-else>
          <div class="w-full h-full min-h-0 flex flex-col gap-4">
            <!-- 列表区域：独立滚动 -->
            <div class="flex-1 min-h-0 overflow-auto">
              <BillList
                :billList="billList"
                :activeAiBillId="activeAiBillId"
                :activeUploadBillId="activeUploadBillId"
                :uploadStatusById="uploadStatusById"
              />
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
