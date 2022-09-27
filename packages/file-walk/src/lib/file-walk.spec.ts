import { fileWalk } from './file-walk';

describe('fileWalk', () => {
  it('should work', () => {
    expect(fileWalk()).toEqual('file-walk');
  });
});
