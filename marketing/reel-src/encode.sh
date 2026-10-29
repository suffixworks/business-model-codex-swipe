set -e
node -e '
const f=require("./frames.json");let out="ffconcat version 1.0\n";
for(let i=0;i<f.length;i++){const d=i<f.length-1?f[i+1][1]-f[i][1]:0.5;out+=`file ${f[i][0]}\nduration ${d.toFixed(4)}\n`}
out+=`file ${f.at(-1)[0]}\n`;require("fs").writeFileSync("list.txt",out)'
ffmpeg -y -v error -f concat -safe 0 -i list.txt -vf "fps=30,scale=out_range=tv,format=yuv420p" -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:v libx264 -preset slow -crf 18 -movflags +faststart -r 30 reel.mp4
mkdir -p check; rm -f check/*
for t in 1.5 4 7 10.5 12.5 15 18 22 26 31 36 42; do ffmpeg -v error -y -ss $t -i reel.mp4 -frames:v 1 -vf scale=270:-1 check/t$t.jpg; done
cd check
ffmpeg -v error -y -i t1.5.jpg -i t4.jpg -i t7.jpg -i t10.5.jpg -i t12.5.jpg -i t15.jpg -filter_complex hstack=inputs=6 sheet1.jpg
ffmpeg -v error -y -i t18.jpg -i t22.jpg -i t26.jpg -i t31.jpg -i t36.jpg -i t42.jpg -filter_complex hstack=inputs=6 sheet2.jpg
ffprobe -v error -show_entries format=duration -of csv=p=0 ../reel.mp4
