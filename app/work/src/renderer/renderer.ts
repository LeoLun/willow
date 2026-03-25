import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./src/App.vue";
import "./index.css";
import "@mariozechner/pi-web-ui";
import { router } from "./src/router";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#root");
