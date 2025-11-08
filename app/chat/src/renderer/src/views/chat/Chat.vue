<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { electronAPI } from '@/lib/ipc'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useRoute } from 'vue-router'
import { AIMessageChunk } from '@langchain/core/messages'

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
}

const route = useRoute()
const message = ref('')
const messages = ref<Message[]>([])
// 从路由上面获取 sessionId
const sessionId = ref('')
onMounted(() => {
  sessionId.value = route.params.sessionId as string;
  // 添加 AI 输出流监听
  electronAPI.onAiStream({ id: sessionId.value, callback: (data: AIMessageChunk) => {
      // 处理不同类型的content
      let contentToAdd = '';
      if (typeof data.content === 'string') {
        contentToAdd = data.content;
      } else if (Array.isArray(data.content)) {
        // 如果content是数组，尝试提取文本内容
        contentToAdd = data.content.map(item => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'text' in item) {
            return item.text;
          }
          return '';
        }).join('');
      }
      
      if (contentToAdd) {
        // 检查是否存在最新的AI消息
        let latestAiMessage = messages.value[messages.value.length - 1];
        
        // 检查当前是否正在进行同一个会话的流式响应
        // 这里我们假设sendMessage后立即会收到对应的AI响应
        // 使用sessionId和类型来判断是否为同一会话的响应
        if (latestAiMessage && latestAiMessage.type === 'ai' && 
            latestAiMessage.id.startsWith(sessionId.value)) {
          // 如果是同一会话的流式响应，则追加内容
          latestAiMessage.content += contentToAdd;
        } else {
          // 如果是新的会话或新的回复，创建新的消息条目
          const newAiMessage: Message = {
            id: `${sessionId.value}_${Date.now()}`, // 使用sessionId和时间戳确保唯一性
            type: 'ai' as const,
            content: contentToAdd
          };
          messages.value.push(newAiMessage);
        }
      }
    }});
})

const sendMessage = async () => {
  if (message.value.trim() === '') return;
  
  // 添加用户消息到消息列表
  messages.value.push({
    id: Date.now().toString(), // 使用时间戳作为临时ID
    type: 'user',
    content: message.value
  });
  
  electronAPI.startAiStream({ id: sessionId.value, messages: message.value });
  // 清空输入框
  message.value = '';
}
</script>

<template>
  <div class="flex flex-col flex-1 w-full h-full">
    <div class="flex flex-col flex-1 mb-4 p-6 overflow-y-auto [scrollbar-gutter:stable_both-edges] [::-webkit-scrollbar-track]:bg-transparent">
      <!-- 渲染消息列表 -->
      <div v-for="msg in messages" :key="msg.id" class="mb-4">
        <div v-if="msg.type === 'user'" class="flex justify-end mb-2">
          <div class="bg-blue-500 text-white p-3 rounded-lg max-w-[70%]">
            {{ msg.content }}
          </div>
        </div>
        <div v-else class="flex justify-start mb-2">
          <div class="bg-gray-200 p-3 rounded-lg max-w-[70%]">
            {{ msg.content }}
          </div>
        </div>
      </div>
    </div>
    <div class="flex items-center justify-center mb-4">
      <Input class="w-2/4 mr-5" v-model="message" placeholder="输入消息"></Input>
      <Button @click="sendMessage">发送</Button>
    </div>
  </div>
</template>