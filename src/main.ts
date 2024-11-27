import computeWGSL from "./compute.wgsl?raw";
import vertWGSL from "./vert.wgsl?raw";
import fragWGSL from "./frag.wgsl?raw";
import tgpu, { TgpuBuffer, Storage } from "typegpu";
import { arrayOf, TgpuArray, U32, u32, vec2u } from "typegpu/data";
import { layout0 as bindGroupLayoutCompute } from "./definitions/compute";
import { layout0 as bindGroupLayoutRender } from "./definitions/vert";

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const root = await tgpu.init();

const context = canvas.getContext("webgpu") as GPUCanvasContext;
const devicePixelRatio = window.devicePixelRatio;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

context.configure({
  device: root.device,
  format: presentationFormat,
});

const GameOptions = {
  width: 128,
  height: 128,
  timestep: 4,
  workgroupSize: 8,
};

const computeShader = root.device.createShaderModule({ code: computeWGSL });

const squareBuffer = root
  .createBuffer(arrayOf(u32, 8), [0, 0, 0, 1, 1, 0, 1, 1])
  .$usage("vertex");

const squareStride: GPUVertexBufferLayout = {
  arrayStride: 2 * Uint32Array.BYTES_PER_ELEMENT,
  stepMode: "vertex",
  attributes: [
    {
      shaderLocation: 1,
      offset: 0,
      format: "uint32x2",
    },
  ],
};

const vertexShader = root.device.createShaderModule({ code: vertWGSL });
const fragmentShader = root.device.createShaderModule({ code: fragWGSL });
let commandEncoder: GPUCommandEncoder;

const cellsStride: GPUVertexBufferLayout = {
  arrayStride: Uint32Array.BYTES_PER_ELEMENT,
  stepMode: "instance",
  attributes: [
    {
      shaderLocation: 0,
      offset: 0,
      format: "uint32",
    },
  ],
};

let wholeTime = 0,
  loopTimes = 0,
  buffer0: TgpuBuffer<TgpuArray<U32>> & Storage,
  buffer1: TgpuBuffer<TgpuArray<U32>> & Storage;

let render: () => void;
function resetGameData() {
  // compute pipeline
  const computePipeline = root.device.createComputePipeline({
    layout: root.device.createPipelineLayout({
      bindGroupLayouts: [root.unwrap(bindGroupLayoutCompute)],
    }),
    compute: {
      module: computeShader,
      constants: {
        blockSize: GameOptions.workgroupSize,
      },
    },
  });
  const sizeBuffer = root
    .createBuffer(vec2u, vec2u(GameOptions.width, GameOptions.height))
    .$usage("uniform")
    .$usage("storage");
  const length = GameOptions.width * GameOptions.height;
  const cells = Array.from({ length }).fill(0) as number[];
  for (let i = 0; i < length; i++) {
    cells[i] = Math.random() < 0.25 ? 1 : 0;
  }
  buffer0 = root
    .createBuffer(arrayOf(u32, length), cells)
    .$usage("storage")
    .$usage("vertex");
  buffer1 = root
    .createBuffer(arrayOf(u32, length))
    .$usage("storage")
    .$usage("vertex");

  const bindGroup0 = bindGroupLayoutCompute.populate({
    size: sizeBuffer,
    current: buffer0,
    next: buffer1,
  });

  const bindGroup1 = bindGroupLayoutCompute.populate({
    size: sizeBuffer,
    current: buffer1,
    next: buffer0,
  });

  const renderPipeline = root.device.createRenderPipeline({
    layout: root.device.createPipelineLayout({
      bindGroupLayouts: [root.unwrap(bindGroupLayoutRender)],
    }),
    primitive: {
      topology: "triangle-strip",
    },
    vertex: {
      module: vertexShader,
      buffers: [cellsStride, squareStride],
    },
    fragment: {
      module: fragmentShader,
      targets: [
        {
          format: presentationFormat,
        },
      ],
    },
  });

  const uniformBindGroup = bindGroupLayoutRender.populate({
    size: sizeBuffer,
  });

  loopTimes = 0;
  render = () => {
    const view = context.getCurrentTexture().createView();
    const renderPass: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    };
    commandEncoder = root.device.createCommandEncoder();

    // compute
    const passEncoderCompute = commandEncoder.beginComputePass();
    passEncoderCompute.setPipeline(computePipeline);
    passEncoderCompute.setBindGroup(
      0,
      root.unwrap(loopTimes ? bindGroup1 : bindGroup0)
    );
    passEncoderCompute.dispatchWorkgroups(
      GameOptions.width / GameOptions.workgroupSize,
      GameOptions.height / GameOptions.workgroupSize
    );
    passEncoderCompute.end();
    // render
    const passEncoderRender = commandEncoder.beginRenderPass(renderPass);
    passEncoderRender.setPipeline(renderPipeline);
    passEncoderRender.setVertexBuffer(
      0,
      root.unwrap(loopTimes ? buffer1 : buffer0)
    );
    passEncoderRender.setVertexBuffer(1, root.unwrap(squareBuffer));
    passEncoderRender.setBindGroup(0, root.unwrap(uniformBindGroup));
    passEncoderRender.draw(4, length);
    passEncoderRender.end();

    root.device.queue.submit([commandEncoder.finish()]);
  };
}

resetGameData();

(function loop() {
  if (GameOptions.timestep) {
    wholeTime++;
    if (wholeTime >= GameOptions.timestep) {
      render();
      wholeTime -= GameOptions.timestep;
      loopTimes = 1 - loopTimes;
    }
  }

  requestAnimationFrame(loop);
})();
