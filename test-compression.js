import { compress, decompress } from 'fzstd';
import brotliPromise from 'brotli-wasm';
import { zipSync, unzipSync } from 'fflate';

async function test() {
  const brotli = await brotliPromise;
  const buf = new Uint8Array([1, 2, 3, 4, 5]);
  
  const zstd = compress(buf);
  console.log('zstd:', zstd.length);
  
  const br = brotli.compress(buf);
  console.log('brotli:', br.length);
  
  const zip = zipSync({ 'test.dat': buf });
  console.log('zip:', zip.length);
}
test();
