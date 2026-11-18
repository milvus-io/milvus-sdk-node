import { HttpBaseClient } from '../HttpClient';
import {
  Constructor,
  FetchOptions,
  FileResourceInfo,
  HttpAddFileResourceReq,
  HttpBaseResponse,
  HttpFileResourceNameReq,
  HttpRunAnalyzerReq,
  HttpRunAnalyzerResult,
} from '../types';
import { parseInt64Fields } from './parseInt64Fields';

const fileResourceIdFields = new Set(['id']);

export function Analyzer<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    get fileResourcePrefix() {
      return '/vectordb/file_resources';
    }

    /** Registers a named file from the Milvus server's storage. */
    addFileResource(params: HttpAddFileResourceReq, options?: FetchOptions) {
      return this.POST<HttpBaseResponse>(
        `${this.fileResourcePrefix}/add`,
        params,
        options
      );
    }

    /** Removes a file resource registration. */
    removeFileResource(
      params: HttpFileResourceNameReq,
      options?: FetchOptions
    ) {
      return this.POST<HttpBaseResponse>(
        `${this.fileResourcePrefix}/remove`,
        params,
        options
      );
    }

    /** Lists file resources and returns IDs as decimal strings. */
    listFileResources(options?: FetchOptions) {
      return this.POST<HttpBaseResponse<FileResourceInfo[]>>(
        `${this.fileResourcePrefix}/list`,
        {},
        options,
        body => parseInt64Fields(body, fileResourceIdFields)
      );
    }

    /** Tokenizes text using inline analyzer settings or a collection field's analyzer. */
    runAnalyzer(params: HttpRunAnalyzerReq, options?: FetchOptions) {
      const { analyzerParams, ...request } = params;
      return this.POST<HttpBaseResponse<HttpRunAnalyzerResult>>(
        '/vectordb/common/run_analyzer',
        {
          ...request,
          analyzerParams:
            typeof analyzerParams === 'string'
              ? analyzerParams
              : JSON.stringify(analyzerParams),
        },
        options
      );
    }
  };
}
