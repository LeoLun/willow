import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./src/App.vue";
import "./index.css";

const app = createApp(App);
app.use(createPinia());
app.mount("#root");