/**
 * WebGPU bootstrap — adapter, device, surface, and shared GPU resources.
 *
 * Extracted from initRenderer() so the main entry point stays focused
 * on pipeline creation and frame-loop orchestration.
 */

import type { GPUContext } from "./types";

/** Everything the renderer needs from the one-time WebGPU setup. */
export interface SetupResult {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  /** Shared GPU resources bundle passed to pipeline factories. */
  gpuCtx: GPUContext;
  /** The bind group that connects the shared uniform buffer to shaders. */
  bindGroup: GPUBindGroup;
  /** The 64-byte uniform buffer holding the view-projection matrix. */
  uniformBuffer: GPUBuffer;
}

/**
 * Requests a WebGPU adapter and device, configures the canvas swap chain,
 * and creates the shared GPU resources (uniform buffer, bind groups, layouts).
 *
 * @param canvas The HTML canvas to render into.
 */
export async function setupGPU(canvas: HTMLCanvasElement): Promise<SetupResult> {
  // --- Adapter & device ---------------------------------------------------
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No WebGPU adapter found.");
  const device = await adapter.requestDevice();

  // --- Surface ------------------------------------------------------------
  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("Could not get WebGPU context.");

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  // --- Resize helper ------------------------------------------------------
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  }
  resize();
  window.addEventListener("resize", resize);

  // --- Shared GPU resources -----------------------------------------------
  const uniformBuffer = device.createBuffer({
    size: 64, // 4x4 float32 matrix
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
    ],
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  const vertexBufferLayout: GPUVertexBufferLayout = {
    arrayStride: 2 * 4,
    attributes: [
      { shaderLocation: 0, offset: 0, format: "float32x2" as GPUVertexFormat },
    ],
  };

  const gpuCtx: GPUContext = {
    device,
    format,
    pipelineLayout,
    vertexBufferLayout,
    bindGroup,
    uniformBuffer,
  };

  return { device, context, format, gpuCtx, bindGroup, uniformBuffer };
}

/**
 * Loads an image from a URL and uploads it to a GPUTexture.
 */
export async function loadTexture(device: GPUDevice, url: string): Promise<GPUTexture> {
  const res = await fetch(url);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);

  const texture = device.createTexture({
    size: [bitmap.width, bitmap.height],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture },
    [bitmap.width, bitmap.height],
  );

  bitmap.close();
  return texture;
}
