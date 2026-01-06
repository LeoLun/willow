<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { Sparkles, LoaderCircle, CheckCircle2, CircleDashed, Upload, Database, AlertTriangle } from 'lucide-vue-next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'


const props = defineProps({
  billList: {
    type: Array,
  },
  activeAiBillId: {
    type: String,
    default: '',
  },
  activeUploadBillId: {
    type: String,
    default: '',
  },
  uploadStatusById: {
    type: Object,
    default: () => ({}),
  },
})
const transactions = computed<any[]>(() => (props.billList as any[]) ?? [])

const rowElById = new Map<string, any>()
const setRowRef = (id: string, elOrComp: any) => {
  if (!id) return
  const el = elOrComp?.$el ?? elOrComp
  if (el) rowElById.set(id, el)
}

const scrollToId = async (id: string) => {
  if (!id) return
  await nextTick()
  const el = rowElById.get(id)
  if (!el?.scrollIntoView) return
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

watch(() => props.activeAiBillId, (id) => {
  if (id) scrollToId(id)
})
watch(() => props.activeUploadBillId, (id) => {
  if (id) scrollToId(id)
})

const aiBadge = (item: any) => {
  const v = item?.category
  if (v === 'wait') return { text: '待 AI', cls: 'bg-muted text-muted-foreground border-border', icon: CircleDashed }
  if (v === 'start') return { text: '解析中', cls: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20', icon: LoaderCircle, spin: true }
  if (v === 'error') return { text: '失败', cls: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertTriangle }
  return { text: v || '未知', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20', icon: Sparkles }
}

const uploadBadge = (id: string) => {
  const st = (props.uploadStatusById as any)?.[id] as string
  if (st === 'uploading') return { text: '上传中', cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20', icon: Upload }
  if (st === 'uploaded') return { text: '已上传', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20', icon: CheckCircle2 }
  if (st === 'skipped') return { text: '已存在', cls: 'bg-muted text-muted-foreground border-border', icon: Database }
  return { text: '未上传', cls: 'bg-background text-muted-foreground border-border', icon: Upload }
}

</script>

<template>
  <div class="w-full">
    <Table>
      <TableHeader class="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <TableRow>
          <TableHead class="min-w-[80px] whitespace-nowrap">AI 分类</TableHead>
          <TableHead class="w-[140px] whitespace-nowrap">上传</TableHead>
          <TableHead class="w-[80px] whitespace-nowrap">序号</TableHead>
          <TableHead class="min-w-[180px] whitespace-nowrap">交易时间</TableHead>
          <TableHead class="min-w-[200px] whitespace-nowrap">交易对方</TableHead>
          <TableHead class="min-w-[150px] whitespace-nowrap">商品</TableHead>
          <TableHead class="w-[100px] whitespace-nowrap">交易方式</TableHead>
          <TableHead class="w-[100px] whitespace-nowrap">收入/支出</TableHead>
          <TableHead class="w-[120px] whitespace-nowrap text-right">金额(元)</TableHead>
          <TableHead class="w-[120px] whitespace-nowrap">交易渠道</TableHead>
          <TableHead class="w-[120px] whitespace-nowrap">当前状态</TableHead>
          <TableHead class="min-w-[150px] whitespace-nowrap">备注</TableHead>
        </TableRow>
      </TableHeader>
      
      <TableBody>
        <TableRow
          v-for="item in transactions"
          :key="item.id"
          :ref="(el:any) => setRowRef(item.id, el)"
          :class="[
            item?.category === 'start' ? 'bg-violet-500/10' : '',
            item.id === activeUploadBillId ? 'bg-blue-500/10' : '',
          ].filter(Boolean).join(' ')"
        >
          <TableCell class="whitespace-nowrap" :title="item.category">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium" :class="aiBadge(item).cls">
                <component :is="aiBadge(item).icon" class="h-3.5 w-3.5" :class="aiBadge(item).spin ? 'animate-spin' : ''" />
                {{ aiBadge(item).text }}
              </span>
            </div>
          </TableCell>
          <TableCell class="whitespace-nowrap">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium" :class="uploadBadge(item.id).cls">
                <component :is="uploadBadge(item.id).icon" class="h-3.5 w-3.5" />
                {{ uploadBadge(item.id).text }}
              </span>
            </div>
          </TableCell>
          <TableCell class="max-w-[200px] text-ellipsis overflow-hidden whitespace-nowrap" :title="item.id">
            {{ item.id }}
          </TableCell>
          <TableCell class="whitespace-nowrap" :title="item.transactionTime">{{ item.transactionTime }}</TableCell>
          <TableCell class="max-w-[200px] text-ellipsis overflow-hidden whitespace-nowrap" :title="item.counterparty">
            {{ item.counterparty }}
          </TableCell>
          <TableCell class="max-w-[200px] text-ellipsis overflow-hidden whitespace-nowrap" :title="item.item">
            {{ item.item }}
          </TableCell>
          <TableCell class="whitespace-nowrap" :title="item.paymentMethod">{{ item.paymentMethod }}</TableCell>
          <TableCell class="whitespace-nowrap" :title="item.direction">{{ item.direction }}</TableCell>
          <TableCell class="text-right font-mono whitespace-nowrap" :class="item.direction === '收入' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'">
            {{ item.direction === '收入' ? '+' : '-' }}{{ item.amount }}
          </TableCell>
          <TableCell class="whitespace-nowrap" :title="item.channel">{{ item.channel }}</TableCell>
          <TableCell class="whitespace-nowrap" :title="item.status">{{ item.status }}</TableCell>
          <TableCell class="max-w-[200px] text-ellipsis overflow-hidden whitespace-nowrap" :title="item.remark">
            {{ item.remark }}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>