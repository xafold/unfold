import json,sys,glob,os
d=sys.argv[1]
for f in sorted(glob.glob(d+'/order*-run*.json')):
  j=json.load(open(f)); o=j.get('structured_output') or json.loads(j['response'])
  u='B' if os.path.basename(f).startswith('order1') else 'A'; b='A' if u=='B' else 'B'
  print('=====',os.path.basename(f),'winner',o['winner'],'(unfold=%s)'%u, 'shots',len(o['screenshots_viewed']))
  for name,k in (('UNFOLD',u),('BASE',b)):
    x=o[k]; print(' --',name,'| weak:',x['biggest_weakness']); print('    strong:',x['biggest_strength'])
    for e in x['factual_errors']: print('    ERR:',e)
  print(' reasons:',o['reasons'])
