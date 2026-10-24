'use strict';
function createService({auth,store}) {
  async function accountId() {
    const {account}=await auth.session();
    if (!account) throw new Error('Sign in to GitHub to open your workspace.');
    return account.id;
  }
  return {
    session:()=>auth.session(),
    login:()=>auth.login(),
    logout:()=>auth.logout(),
    load:async()=>store.load(await accountId()),
    save:async(workspace)=>store.save(await accountId(),workspace)
  };
}
module.exports={createService};
