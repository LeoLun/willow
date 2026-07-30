/* eslint-disable */
import { createPinia } from "pinia";
import { createApp } from "vue";
import "katex/dist/katex.min.css";
import App from "./src/App.vue";
import "./index.css";
import { router } from "./src/router.js";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#root");
