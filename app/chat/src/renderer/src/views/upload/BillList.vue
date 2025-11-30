<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Sparkles, LoaderCircle } from 'lucide-vue-next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'


const transactions = ref<any[]>([])
const props = defineProps({
  billList: {
    type: Array,
  },
})

onMounted(() => {
  transactions.value = props.billList;
})

</script>

<template>
  <div class="w-full overflow-auto">
    <Table>
      <TableHeader class="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <TableRow>
          <TableHead class="w-[80px] whitespace-nowrap">序号</TableHead>
          <TableHead class="min-w-[150px] whitespace-nowrap">交易类型</TableHead>
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
        <TableRow v-for="item in transactions" :key="item.id">
          <TableCell class="max-w-[200px] text-ellipsis overflow-hidden whitespace-nowrap" :title="item.id">
            {{ item.id }}
          </TableCell>
          <TableCell class="whitespace-nowrap" :title="item.category">
            <template v-if="item.category === 'wait'">
              <LoaderCircle  class="animate-spin"/>
            </template>
            <template v-else-if="item.category === 'start'">
              <Sparkles 
                class="animate-pulse text-[rgba(131,80,242,1)]"
              />
            </template>
            <template v-else>
              {{ item.category }}
            </template>
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
          <TableCell class="text-right font-mono whitespace-nowrap" :class="item.direction === '收入' ? 'text-green-600' : 'text-slate-900'">
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