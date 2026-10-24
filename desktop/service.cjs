'use strict';
function createService({auth,store}) {
  let boundAccount=null;
  async function refresh(method) {
    const state=await auth[method]();
    boundAccount=state.account?.id??null;
    return state;
  }
  async function accountId() {
    const {account}=await auth.session();
    if (!account) throw new Error('Sign in to GitHub to open your workspace.');
    if (boundAccount!==null && boundAccount!==account.id) {
      throw new Error('GitHub account changed. Disconnect and check sign-in before opening or saving another workspace.');
    }
    boundAccount=account.id;
    return account.id;
  }
  return {
    session:()=>refresh('session'),
    login:()=>refresh('login'),
    logout:async()=>{const state=await auth.logout();boundAccount=null;return state;},
    load:async()=>store.load(await accountId()),
    save:async(workspace)=>store.save(await accountId(),workspace)
  };
}
module.exports={createService};
