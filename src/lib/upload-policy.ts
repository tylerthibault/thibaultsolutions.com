import path from "node:path";
export const acceptedVideoTypes = new Map([["video/mp4",".mp4"],["video/quicktime",".mov"],["video/x-m4v",".m4v"],["video/webm",".webm"]]);
export const acceptedVideoExtensions = new Set([".mp4",".mov",".m4v",".webm"]);
export function validateUploadHeaders(mime:string,name:string,size:number,max:number){const ext=acceptedVideoTypes.get(mime);if(!ext)return{ok:false as const,error:"Unsupported video type"};if(!acceptedVideoExtensions.has(path.extname(name).toLowerCase()))return{ok:false as const,error:"Unsupported file extension"};if(size>0&&size>max)return{ok:false as const,error:"File exceeds upload limit"};return{ok:true as const,extension:ext}}
