import {
  AutomationCreateRendererFactory,
  TodoRendererFactory,
  registerToolRenderer,
} from "@willow/ui";
import { createApp } from "vue";
import App from "./App.vue";
import "./index.css";

registerToolRenderer("todoread", new TodoRendererFactory());
registerToolRenderer("todowrite", new TodoRendererFactory());
registerToolRenderer("automation_create", new AutomationCreateRendererFactory());

createApp(App).mount("#app");
