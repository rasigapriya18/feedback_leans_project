const esbuild=require('esbuild');
const options={entryPoints:['src/main.jsx'],bundle:true,external:['/vendor/*'],outdir:'public/assets',entryNames:'app',format:'esm',splitting:true,minify:true,sourcemap:true};
(async()=>{if(process.argv.includes('--watch')){const ctx=await esbuild.context(options);await ctx.watch();console.log('Watching React source; run node server.cjs in another terminal.')}else await esbuild.build(options)})().catch(()=>process.exit(1));
