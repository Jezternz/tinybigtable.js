class TinyBigTable
{
    static create(opts)
    {
        if(!TinyBigTable.styleHasBeenInitialized)
        {
            TinyBigTable.styleHasBeenInitialized = true;
            this._initializeStyle();
        }
        if(!TinyBigTable.counter)
        {
            TinyBigTable.counter = 1;
        }
        const table = new TinyBigTable();
        table._initialize(Object.assign({ tableId: TinyBigTable.counter++ }, opts));
        return table;
    }
    
    static _initializeStyle()
    {
        const styleEl = document.createElement('style');
        document.head.appendChild(styleEl);
        TinyBigTable.tableStyles.split("}")
            .map(s => s.trim()+"}")
            .slice(0, -1)
            .forEach(s => 
                styleEl.sheet.insertRule(s, styleEl.sheet.cssRules.length));					
    }
    
    static get tableStyles()
    {
        return `						
            .tbt{position: relative;width: 100%;height: 100%;border: 1px solid #888;box-sizing:border-box;}
            .tbt .tbt-head, .tbt .tbt-body{position:absolute;}
            .tbt .tbt-head{top: 0;left: 0;right: 0;overflow:hidden;}
            .tbt .tbt-body{left:0;right:0;bottom:0;overflow:auto;}
            .tbt .tbt-row{position:absolute;}
            .tbt .tbt-body .tbt-row{box-sizing:border-box;}
            .tbt .tbt-cell{position:absolute;min-width:30px;min-height:30px;top:0;}
            .tbt .tbt-cell{border-width:0 1px 1px 0;border-style:solid;border-color:#888;}
            .tbt .tbt-body .tbt-scroller{position:absolute;top:0;left:0;}
        `;
    }    
    
    setParent(parent)
    {
        this._s.parent = this._domObj(parent);
        if(!this._s.parent)throw new Error("TinyBigTable parent must be a css query string or dom element.");
        this._s.parent.append(this._s.container);
        this._renderCellWindow();
    }
    
    setBufferSize(bufferSize = 50)
    {
        this._s.bufferSize = bufferSize;
    }
    
    setTableSize({ rowCount = 0, colCount = 0 })
    {
        this._s.rowCount = rowCount;
        this._s.colCount = colCount;
    }
    
    setCellGroupPreRender(cellGroupPreRenderer)
    {
        this._s.cellGroupPreRenderer = cellGroupPreRenderer;
    }
    
    setCellRenderer(cellRenderer)
    {
        this._s.cellRenderer = cellRenderer;
    }
    
    updateGroupData(gridData)
    {
        const gridDataRowKeys = Object.keys(gridData);
        for(let i=0;i<gridDataRowKeys.length;i++)
        {
            const y = +gridDataRowKeys[i];
            const row = gridData[y];
            const gridDataColKeys = Object.keys(row);

            if(y === 0)
            {
                for(let j=0;j<gridDataColKeys.length;j++)
                {
                    const x = +gridDataColKeys[j];
                    const cell = gridData[y][x];
                    const result = this._s.cellRenderer.call(this, { x, y }, cell, row);
                    Promise.resolve(result)
                        .catch(er => `<span style="color:red;">Rendering failed:${er}</span>`)
                        .then(res => this._s.virtualHeadCells[x].innerHTML = res);
                }
            }
            else
            {
                const match = this._s.virtualRowCache.filter(r => r.rowI === y).pop();
                if(match)
                {
                    for(let j=0;j<gridDataColKeys.length;j++)
                    {
                        const x = +gridDataColKeys[j];
                        const cell = gridData[y][x];
                        const result = this._s.cellRenderer.call(this, { x, y }, cell, row);
                        Promise.resolve(result)
                            .catch(er => `<span style="color:red;">Rendering failed:${er}</span>`)
                            .then(res => { if(match.rowI === y) match.cellEls[x].innerHTML = res; });
                    }
                }
            }
        }
    }
    
    focus({ x, y })
    {
        this._s.body.scroll({
            top: Math.floor((y * this._s.rowHeight) + (this._s.rowHeight / 2) - (this._s.tableHeight / 2)), 
            left: Math.floor((x * this._s.minCellWidth) + (this._s.minCellWidth / 2) - (this._s.tableWidth / 2)), 
            behavior: 'auto'
        });
    }
    
    renderCell({ x, y })
    {
        /*const match = this._s.virtualRowCache.filter(r => r.rowI === y).pop();
        if(match)
        {
            const cell = gridData[y][x];
            const result = this._s.cellRenderer.call(this, { x, y }, cell, row);
            Promise.resolve(result)
                .catch(er => `<span style="color:red;">Rendering failed:${er}</span>`)
                .then(res => { if(match.rowI === y) match.cellEls[x].innerHTML = res; });
        }*/
    }
    
    renderCellGroup({ xStart, xEnd, yStart, yEnd })
    {

    }				
    
    _initialize({
        parent,
        tableSize: { rowCount, colCount } = {},
        cellGroupPreRenderer,
        bufferSize = 40,
        scrollThrottle = 50,
        cellRenderer,
        tableId
    } = {})
    {
        const bufferBelow = Math.floor(bufferSize/2);
        const bufferAbove = bufferSize-bufferBelow;
        this._s = { bufferSize, bufferBelow, bufferAbove, tableId: `tbt-${tableId}`, scrollThrottle };
        this._s.ready = false;
        
        this._s.container = document.createElement("div");
        this._s.container.classList.add("tbt");
        this._s.container.classList.add(this._s.tableId);
        this._s.container.innerHTML = `
            <div class="tbt-head">
                <div class="tbt-row"></div>
            </div>
            <div class="tbt-body">
                <div class="tbt-scroller"></div>
            </div>
        `;
        this._s.head = this._s.container.querySelector(".tbt-head");
        this._s.headRow = this._s.head.querySelector(".tbt-row");
        this._s.body = this._s.container.querySelector(".tbt-body");
        this._s.body.addEventListener("scroll", this._preScrollChanged());
        this._s.bodyScroller = this._s.body.querySelector(".tbt-body div:nth-child(1)");
        
        this.setParent(parent);
        this.setBufferSize(bufferSize);
        
        if(rowCount || colCount)this.setTableSize({ rowCount, colCount });
        if(cellGroupPreRenderer)this.setCellGroupPreRender(cellGroupPreRenderer);
        if(cellRenderer)this.setCellRenderer(cellRenderer);
        
        this._s.ready = true;
        
        this._renderCellWindow();
    }
    
    _renderCellWindow()
    {
        if(!this._s.ready)return;
        this._initializeCellWindowSize();
    }
    
    _initializeCellWindowSize()
    {
        if(!this._s.ready)return;
        
        this._s.tableWidth = this._s.container.offsetWidth;
        this._s.tableHeight = this._s.container.offsetHeight;
        
        if(!this._s.headHeightCalculator)
        {
            this._s.headHeightCalculator = document.createElement("div");
            this._s.headHeightCalculatorChild = document.createElement("div");
            this._s.headHeightCalculator.append(this._s.headHeightCalculatorChild);
        }					
        this._s.body.append(this._s.headHeightCalculator);
        this._s.headHeightCalculator.className = "tbt-row";
        this._s.headHeightCalculatorChild.className = "tbt-cell";
        this._s.rowHeight = this._s.headHeightCalculatorChild.offsetHeight;
        this._s.head.style.height = `${this._s.rowHeight}px`;
        this._s.body.style.top = `${this._s.rowHeight}px`;
        this._s.body.removeChild(this._s.headHeightCalculator);

        if(!this._s.bodyHeightCalculator)
        {
            this._s.bodyHeightCalculator = document.createElement("div");
            this._s.bodyHeightCalculatorChild = document.createElement("div");
            this._s.bodyHeightCalculator.append(this._s.bodyHeightCalculatorChild);
        }
        this._s.body.append(this._s.bodyHeightCalculator);
        this._s.bodyHeightCalculator.className = "tbt-row";
        this._s.bodyHeightCalculatorChild.className = "tbt-cell";
        this._s.minCellWidth = this._s.bodyHeightCalculatorChild.offsetWidth;
        this._s.rowHeight = this._s.bodyHeightCalculatorChild.offsetHeight;
        this._s.allRowsHeight = (this._s.rowHeight * (this._s.rowCount-1)) + 1;
        this._s.allColsWidth = (this._s.minCellWidth * this._s.colCount) + 1;
        this._s.bodyScroller.style.height = `${this._s.allRowsHeight}px`;
        this._s.bodyScroller.style.width = `${this._s.allColsWidth}px`;
        this._s.body.removeChild(this._s.bodyHeightCalculator);

        this._s.virtualRowStart = -1;
        this._s.virtualRowEnd = -1;
        
        this._s.rowsFitOnScreen = Math.ceil(this._s.tableHeight / this._s.rowHeight) + 1;
        this._s.rowsFitOnScreenWithBuffer = this._s.rowsFitOnScreen + this._s.bufferSize;
        console.log(`fitonscreen: ${this._s.rowsFitOnScreen}, withBuffer: ${this._s.rowsFitOnScreenWithBuffer}`)
        
        if(!this._s.rowElements)
        {
            this._s.rowElements = [];
        }
        const rowsToCreateCount = Math.max(this._s.rowsFitOnScreenWithBuffer-this._s.rowElements.length, 0);
        if(rowsToCreateCount > 0)
        {
            this._s.virtualRowCache = [
                ...this._s.rowElements,
                ...Array(rowsToCreateCount)
                    .fill(0)
                    .map(() => 
                    {
                        const rowEl = document.createElement("div");
                        const cellEls = Array(this._s.colCount).fill(0).map(c =>
                        {
                            const cEl = document.createElement("div");
                            cEl.className = "tbt-cell";
                            rowEl.append(cEl);
                            return cEl;
                        });
                        rowEl.className = "tbt-row";
                        this._s.body.append(rowEl);
                        return { rowEl, cellEls, rowI: -1 };
                    })
                ];
        }

        this._s.virtualHeadCells = Array(this._s.colCount).fill(0).map(c =>
        {
            const cEl = document.createElement("div");
            cEl.className = "tbt-cell";
            this._s.headRow.append(cEl);
            return cEl;
        });

        this._s.cellWidths = Array(this._s.colCount).fill(this._s.minCellWidth);
        let runningLeftCounter = 0;
        this._s.cellLefts = Array(this._s.colCount).fill(0).map((z, i) => {
            const left = runningLeftCounter;
            runningLeftCounter += this._s.cellWidths[i];
            return left;
        });
        this._updateCellWidths();

        // populate cells


        this._scrollChanged();
        this._renderHead();
    }

    _updateCellWidths()
    {
        if(!this._s.cellWidthStylesheet)
        {
            const styleEl = document.createElement('style');
            document.head.appendChild(styleEl);
            this._s.cellWidthStylesheet = styleEl.sheet;
        }

        for(let i=0;i<Math.min(this._s.cellWidthStylesheet.cssRules.length, this._s.colCount);i++)
        {
            this._s.cellWidthStylesheet.cssRules[i].style.minWidth = `${this._s.cellWidths[i]}px`;
            this._s.cellWidthStylesheet.cssRules[i].style.left = `${this._s.cellLefts[i]}px`;
        }
        if(this._s.colCount < this._s.cellWidthStylesheet.cssRules.length)
        {
            // need to delete rules
            throw new Error("TODO");
        }
        else if(this._s.colCount > this._s.cellWidthStylesheet.cssRules.length)
        {
            // need to add rules
            const addRulesCount = this._s.colCount-this._s.cellWidthStylesheet.cssRules.length;
            const startFrom = this._s.cellWidthStylesheet.cssRules.length;
            Array(addRulesCount).fill(0).forEach((z, i) =>
            {
                const newI = startFrom + i;
                this._s.cellWidthStylesheet.insertRule(
                    `.${this._s.tableId} .tbt-cell:nth-child(${newI+1}){min-width:${this._s.cellWidths[newI]}px;left:${this._s.cellLefts[newI]}px;}`, 
                    this._s.cellWidthStylesheet.length);
            });
        }

    }

    _preScrollChanged()
    {
        let fn = this._headThrottle(this._scrollChanged, this._s.scrollThrottle);
        return () =>
        {
            this._s.currentScrollY = document.querySelector(".tbt-body").scrollTop;
            this._s.currentScrollX = document.querySelector(".tbt-body").scrollLeft;
            
            this._s.headRow.style.left = `-${this._s.currentScrollX}px`;
            fn();
        }
    }

    _scrollChanged()
    {
        const rowPos = Math.floor(this._s.currentScrollY / this._s.rowHeight);

        if(this._s.virtualRowStart === -1)
        {
            this._s.virtualRowStart = 1;
            for(let i=this._s.virtualRowStart;i<this._s.virtualRowCache.length;i++)
            {
                this._s.virtualRowCache[i].rowI = i;
                this._s.virtualRowCache[i].rowEl.style.top = `${(this._s.virtualRowCache[i].rowI-1) * this._s.rowHeight}px`;
            }
            this._s.virtualRowEnd = this._s.virtualRowCache.length;
            this._s.cellGroupPreRenderer.call(
                    this, 
                    { 
                        xStart: 0, 
                        xEnd: this._s.colCount-1, 
                        yStart: this._s.virtualRowStart, 
                        yEnd: this._s.virtualRowEnd
                    },
                    this.updateGroupData.bind(this));
        }
        else
        {
            const oldRowStart = this._s.virtualRowStart;
            const oldRowEnd = this._s.virtualRowEnd;
            const newRowStart = this._s.virtualRowStart = Math.min(
                Math.max(1, rowPos-this._s.bufferBelow), 
                this._s.rowCount-this._s.rowsFitOnScreenWithBuffer
            );
            const newRowEnd = this._s.virtualRowEnd = Math.max(
                Math.min(this._s.rowCount, newRowStart+this._s.rowsFitOnScreen+this._s.bufferSize),
                this._s.virtualRowCache.length-1
            );

            console.log(`${oldRowStart}-${oldRowEnd} ----> ${newRowStart}-${newRowEnd}`)

            if(oldRowStart < newRowStart && oldRowEnd > newRowEnd)
            {
                // new Row Buffer is Larger then old buffer (and completely contains the old buffer)
                throw new Error("Not implemented buffer size change (grow) unsupported...");
            }
            else if(oldRowStart > newRowStart && oldRowEnd < newRowEnd)
            {
                // old Row Buffer is Larger then new buffer (and completely contains the new buffer)
                throw new Error("Not implemented buffer size change (shrink) unsupported...");
            }
            else if(newRowStart > oldRowStart)
            {
                // new Row buffer is ahead of old row buffer (user has scrolled down)
                // Scroll down = take some from top, and move to bottom, rerender these bottom ones.
                const moveDownCount = Math.min(newRowStart-oldRowStart, this._s.virtualRowCache.length);
                const moveDownStart = Math.max(oldRowEnd, newRowStart);
                console.log(`scrolled down moveDownCount:${moveDownCount} moveDownStart:${moveDownStart} -> ${this._s.virtualRowCache.map(r => r.rowI).join()}`)
                for(let i=0;i<moveDownCount;i++)
                {
                    this._s.virtualRowCache[i].rowI = moveDownStart + i;
                    this._s.virtualRowCache[i].rowEl.style.top = `${(this._s.virtualRowCache[i].rowI-1) * this._s.rowHeight}px`;
                }
                this._s.virtualRowCache = 
                [
                    ...this._s.virtualRowCache.slice(moveDownCount),
                    ...this._s.virtualRowCache.slice(0, moveDownCount)
                ];
                this._s.cellGroupPreRenderer.call(
                        this, 
                        { 
                            xStart: 0, 
                            xEnd: this._s.colCount-1, 
                            yStart: moveDownStart, 
                            yEnd: newRowEnd
                        },
                        this.updateGroupData.bind(this));
            } 
            else if(newRowStart < oldRowStart)
            {
                // new row buffer is before old row buffer (user has scrolled up)
                // Scroll up = take some from bottom, and move to top, rerender these top ones.
                const moveUpCount = Math.min(oldRowEnd-newRowEnd, this._s.virtualRowCache.length);
                const moveUpStart = Math.min(oldRowStart, newRowEnd);
                console.log(`1) scrolled up moveUpCount:${moveUpCount} moveUpStart:${moveUpStart} -> ${this._s.virtualRowCache.map(r => r.rowI).join()}`);

                for(let i=0;i<moveUpCount;i++)
                {
                    const ii = this._s.virtualRowCache.length - i - 1;
                    this._s.virtualRowCache[ii].rowI = moveUpStart - i - 1;
                    this._s.virtualRowCache[ii].rowEl.style.top = `${(this._s.virtualRowCache[ii].rowI-1) * this._s.rowHeight}px`;
                }

                this._s.virtualRowCache = 
                [
                    ...this._s.virtualRowCache.slice(-moveUpCount),
                    ...this._s.virtualRowCache.slice(0, -moveUpCount)
                ];

                this._s.cellGroupPreRenderer.call(
                        this, 
                        { 
                            xStart: 0, 
                            xEnd: this._s.colCount-1, 
                            yStart: moveUpStart-moveUpCount, 
                            yEnd: moveUpStart
                        },
                        this.updateGroupData.bind(this));
            }
            else if(newRowStart == oldRowStart)
            {
                // row buffers do not need to move
                console.log('scrolled no effect')
            }
        }

    }

    _renderHead()
    {
        this._s.cellGroupPreRenderer.call(
                this, 
                { 
                    xStart: 0, 
                    xEnd: this._s.colCount-1, 
                    yStart: 0, 
                    yEnd: 1
                },
                this.updateGroupData.bind(this));
    }

    _headThrottle(throttleFn, time)
    {
        var timeOut = null;
        return evt =>
        {
            if(timeOut !== null)
            {
                clearTimeout(timeOut);
                timeOut = null;
            };
            timeOut = setTimeout(() =>
            {
                timeOut = null;
                throttleFn.call(this, evt);
            }, time);
        };
    }
    
    _domObj(d)
    { 
        return d instanceof HTMLElement ? d : typeof d === "string" ? document.querySelector(d) : null; 
    }
}