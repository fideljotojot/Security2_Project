import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { parse, compileTemplate } from '@vue/compiler-sfc';

for (const role of ['admin','superadmin']) test(`${role} Accounts hides incomplete rows before search and pagination`, async () => {
  let source=await readFile(new URL(`../src/assets/JS/${role}/users.js`,import.meta.url),'utf8');
  source=source.replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.env','({})').replace('export default','globalThis.component =');
  const context={};vm.runInNewContext(source,context);const c=context.component,s=c.data();
  for(const [name,fn] of Object.entries(c.methods))s[name]=fn.bind(s);
  for(const [name,fn] of Object.entries(c.computed))Object.defineProperty(s,name,{get:()=>fn.call(s)});
  s.users=Array.from({length:12},(_,i)=>({user_id:String(i),id_number:String(i),username:'visible'+i,role:'user',position:'Student',registration_status:'approved'}));
  const incomplete={user_id:'hidden',id_number:'100',username:'hidden-account',role:'superadmin',registration_status:'incomplete'};
  s.users.push(incomplete,{user_id:'root',role:'superadmin',registration_status:'incomplete',username:'hidden-root'});
  const list=()=>role==='admin'?s.filtered:s.filteredUsers;
  assert.equal(list().length,12);assert.equal(s.pageCount,2);assert.equal(s.users.length,14);
  if(role==='superadmin')assert(s.superadminLimitReached);
  if(role==='admin')s.search='hidden-account';else s.searchQuery='hidden-account';
  assert.equal(list().length,0);
  incomplete.registration_status='approved';
  assert.equal(list().length,1);assert.equal(list()[0].user_id,'hidden');
  const filename=`src/components/${role}/${role==='admin'?'AdminUsers':'SuperadminUsers'}.vue`;
  const content=await readFile(new URL('../'+filename,import.meta.url),'utf8');
  assert(!content.includes('<option value="incomplete">'));
  const {descriptor,errors}=parse(content);assert.deepEqual(errors,[]);
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:role+'-users'}).errors,[]);
});
