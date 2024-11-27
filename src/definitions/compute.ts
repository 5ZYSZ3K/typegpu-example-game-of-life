/* generated via tgpu-gen by TypeGPU */
import tgpu from "typegpu";
import * as d from "typegpu/data";

/* bindGroupLayouts */
export const bindGroupLayoutCompute = tgpu.bindGroupLayout({
  size: {
    storage: d.vec2u,
    access: "readonly",
  },
  current: {
    storage: (arrayLength: number) => d.arrayOf(d.u32, arrayLength),
    access: "readonly",
  },
  next: {
    storage: (arrayLength: number) => d.arrayOf(d.u32, arrayLength),
    access: "mutable",
  },
});
