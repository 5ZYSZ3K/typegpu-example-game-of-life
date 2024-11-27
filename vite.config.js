import vitePluginString from "vite-plugin-string";
import { shaderPlugin } from "./src/shader-plugin";

export default {
  plugins: [vitePluginString(), shaderPlugin()],
};
