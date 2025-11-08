<script setup lang="ts">
import { ref } from 'vue'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { electronAPI } from '@/lib/ipc'
import { useRouter } from 'vue-router'

const router = useRouter()

const message = ref('')

const sendMessage = async () => {
  if (message.value.trim() === '') return;
  
  const { id: sessionId } = await electronAPI.createChatSession();
  console.log(sessionId);
  // 跳转到/chat/sessionId
  router.push(`/chat/${sessionId}`);
  
  // 清空输入框
  message.value = '';
}

const renameSession = async () => {
  await electronAPI.aiRename();
}
</script>
<template>
  <div class="flex flex-1 flex-col w-full h-full items-center justify-center">
    <div class="flex items-center justify-center w-2/4">
      <Input class="mr-5" v-model="message" placeholder="输入消息"></Input>
      <Button @click="sendMessage">发送</Button>
    </div>
    <div class="flex w-2/4 mt-5">
      <Button class="mr-2" @click="renameSession">AI重命名</Button>
      <Button>AI整理</Button>
    </div>
  </div>
</template>