set -e
node -e '
const f=require("./frames.json");let out="ffconcat version 1.0\n";
for(let i=0;i<f.length;i++){const d=i<f.length-1?f[i+1][1]-f[i][1]:0.5;out+=`file ${f[i][0]}\nduration ${d.toFixed(4)}\n`}
out+=`file ${f.at(-1)[0]}\n`;require("fs").writeFileSync("list.txt",out)'
ffmpeg -y -v error -f concat -safe 0 -i list.txt -vf "fps=30,scale=out_range=tv,format=yuv420p" -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:v libx264 -preset slow -crf 18 -movflags +faststart -r 30 reel.mp4
mkdir -p check; rm -f check/*
for t in 1.5 4 6 8.5 11 13.5 16 19 22 25 28 31; do ffmpeg -v error -y -ss $t -i reel.mp4 -frames:v 1 -vf scale=270:-1 check/t$t.jpg; done
cd check
ffmpeg -v error -y -i t1.5.jpg -i t4.jpg -i t6.jpg -i t8.5.jpg -i t11.jpg -i t13.5.jpg -filter_complex hstack=inputs=6 sheet1.jpg
ffmpeg -v error -y -i t16.jpg -i t19.jpg -i t22.jpg -i t25.jpg -i t28.jpg -i t31.jpg -filter_complex hstack=inputs=6 sheet2.jpg
ffprobe -v error -show_entries format=duration -of csv=p=0 ../reel.mp4
