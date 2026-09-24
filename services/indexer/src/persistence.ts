import{mkdir,readFile,rename,writeFile}from"node:fs/promises";import{dirname}from"node:path";import type{ProjectionStore}from"./store.ts";
export async function loadSnapshot(store:ProjectionStore,path:string){try{store.restore(JSON.parse(await readFile(path,"utf8")));return true}catch(e:any){if(e?.code==="ENOENT")return false;throw e}}
export async function saveSnapshot(store:ProjectionStore,path:string){await mkdir(dirname(path),{recursive:true});const temp=`${path}.${process.pid}.tmp`;await writeFile(temp,JSON.stringify(store.snapshot()),"utf8");await rename(temp,path)}
