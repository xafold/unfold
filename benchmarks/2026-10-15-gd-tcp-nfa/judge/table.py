import json,sys,glob,os
C=["accuracy","core_idea_clarity","visual_explanation","interactivity","coverage","depth","visual_design","mobile_and_accessibility"]
d=sys.argv[1]; su={c:0 for c in C}; sb={c:0 for c in C}; w={'unfold':0,'baseline':0,'tie':0}; n=0; runs=[]
for f in sorted(glob.glob(d+'/order*-run*.json')):
  j=json.load(open(f)); o=j.get('structured_output') or json.loads(j['response'])
  u='B' if os.path.basename(f).startswith('order1') else 'A'; b='A' if u=='B' else 'B'
  for c in C: su[c]+=o[u]['scores'][c]; sb[c]+=o[b]['scores'][c]
  win='tie' if o['winner']=='tie' else ('unfold' if o['winner']==u else 'baseline'); w[win]+=1; n+=1
  runs.append(f"{os.path.basename(f)[:-5]} {win} ({sum(o[u]['scores'].values())}-{sum(o[b]['scores'].values())})")
print(f"Wins: unfold {w['unfold']}, baseline {w['baseline']}, tie {w['tie']}. Runs: "+"; ".join(runs)+".\n")
print("| Criterion | unfold | baseline |\n|---|---|---|")
for c in C: print(f"| {c} | {su[c]/n:.2f} | {sb[c]/n:.2f} |")
print(f"| **total /80** | **{sum(su.values())/n:.2f}** | **{sum(sb.values())/n:.2f}** |")
