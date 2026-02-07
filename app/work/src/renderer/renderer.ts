import { createApp } from 'vue'
import App from './src/App.vue'
import './index.css';

createApp(App).mount('#root')


console.log('👋 This message is being logged by "renderer.js", included via webpack');