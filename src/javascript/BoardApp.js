(function() {
    var Ext = window.Ext4 || window.Ext;

    Ext.define('Rally.apps.board.BoardApp', {
        extend: 'Rally.app.App',
        alias: 'widget.boardapp',

        requires: [
            'Rally.ui.cardboard.plugin.FixedHeader',
            'Rally.ui.gridboard.GridBoard',
            'Rally.ui.gridboard.plugin.GridBoardAddNew',
            'Rally.ui.gridboard.plugin.GridBoardInlineFilterControl',
            'Rally.ui.gridboard.plugin.GridBoardFieldPicker',
            'Rally.data.util.Sorter',
            'Rally.apps.board.Settings',
            'Rally.clientmetrics.ClientMetricsRecordable'
        ],
        mixins: [
            'Rally.clientmetrics.ClientMetricsRecordable'
        ],

        helpId: 287,
        cls: 'customboard',
        autoScroll: false,
        layout: {
            type: 'vbox',
            align: 'stretch'
        },
        items: [{
            id: Utils.AncestorPiAppFilter.RENDER_AREA_ID,
            xtype: 'container',
            layout: {
                type: 'hbox',
                align: 'middle',
                defaultMargins: '0 10 10 0',
            }
        }, {
            id: 'grid-area',
            xtype: 'container',
            flex: 1,
            type: 'vbox',
            align: 'stretch'
        }],
        config: {
            defaultSettings: {
                type: 'HierarchicalRequirement',
                groupByField: 'ScheduleState',
                showRows: false
            }
        },

        launch: function() {
            this.ancestorFilterPlugin = Ext.create('Utils.AncestorPiAppFilter', {
                ptype: 'UtilsAncestorPiAppFilter',
                pluginId: 'ancestorFilterPlugin',
                settingsConfig: {
                    //labelWidth: 150,
                    //margin: 10
                },
                listeners: {
                    scope: this,
                    ready: function(plugin) {
                        Rally.data.util.PortfolioItemHelper.getPortfolioItemTypes().then({
                            scope: this,
                            success: function(portfolioItemTypes) {
                                this.portfolioItemTypes = portfolioItemTypes;
                                Rally.data.ModelFactory.getModel({
                                    type: this.getSetting('type'),
                                    context: this.getContext().getDataContext()
                                }).then({
                                    success: function(model) {
                                        plugin.addListener({
                                            scope: this,
                                            select: function() {
                                                this._addBoard();
                                            }
                                        });
                                        this.model = model;
                                        this._addBoard();
                                    },
                                    scope: this
                                });
                            }
                        })
                    },
                }
            });
            this.addPlugin(this.ancestorFilterPlugin);
        },

        // Usual monkey business to size gridboards
        onResize: function() {
            this.callParent(arguments);
            var gridArea = this.down('#grid-area');
            var gridboard = this.down('rallygridboard');
            if (gridArea && gridboard) {
                gridboard.setHeight(gridArea.getHeight())
            }
        },

        _getGridBoardConfig: function() {
            var context = this.getContext();
            var dataContext = context.getDataContext();
            if (this.searchAllProjects()) {
                dataContext.project = null;
            }
            var gridArea = this.down('#grid-area');
            var modelNames = [this.getSetting('type')],
                blackListFields = ['Successors', 'Predecessors', 'DisplayColor'],
                whiteListFields = ['Milestones', 'Tags'],
                config = {
                    xtype: 'rallygridboard',
                    stateful: false,
                    toggleState: 'board',
                    height: gridArea.getHeight(),
                    cardBoardConfig: this._getBoardConfig(),
                    plugins: [{
                            ptype: 'rallygridboardaddnew',
                            addNewControlConfig: {
                                stateful: true,
                                stateId: context.getScopedStateId('board-add-new')
                            }
                        },
                        {
                            ptype: 'rallygridboardinlinefiltercontrol',
                            inlineFilterButtonConfig: {
                                stateful: true,
                                stateId: context.getScopedStateId('board-inline-filter'),
                                modelNames: modelNames,
                                legacyStateIds: [
                                    context.getScopedStateId('board-owner-filter'),
                                    context.getScopedStateId('board-custom-filter-button')
                                ],
                                filterChildren: true,
                                inlineFilterPanelConfig: {
                                    quickFilterPanelConfig: {
                                        portfolioItemTypes: this.portfolioItemTypes,
                                        modelName: modelNames[0],
                                        defaultFields: ['ArtifactSearch', 'Owner'],
                                        addQuickFilterConfig: {
                                            blackListFields: blackListFields,
                                            whiteListFields: whiteListFields
                                        }
                                    },
                                    advancedFilterPanelConfig: {
                                        advancedFilterRowsConfig: {
                                            propertyFieldConfig: {
                                                blackListFields: blackListFields,
                                                whiteListFields: whiteListFields
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        {
                            ptype: 'rallygridboardfieldpicker',
                            headerPosition: 'left',
                            boardFieldBlackList: blackListFields,
                            modelNames: modelNames
                        }
                    ],
                    context: context,
                    modelNames: modelNames,
                    storeConfig: {
                        filters: this._getFilters(),
                        context: dataContext
                    },
                    listeners: {
                        load: this._onLoad,
                        scope: this
                    }
                };
            if (this.getEl()) {
                config.height = this.getHeight();
            }
            return config;
        },

        _onLoad: function() {
            this.recordComponentReady({
                miscData: {
                    type: this.getSetting('type'),
                    columns: this.getSetting('groupByField'),
                    rows: (this.getSetting('showRows') && this.getSetting('rowsField')) || ''
                }
            });
        },

        _getBoardConfig: function() {
            var boardConfig = {
                margin: '10px 0 0 0',
                attribute: this.getSetting('groupByField'),
                context: this.getContext(),
                cardConfig: {
                    editable: true,
                    showIconMenus: true
                },
                loadMask: true,
                plugins: [{ ptype: 'rallyfixedheadercardboard' }],
                storeConfig: {
                    sorters: Rally.data.util.Sorter.sorters(this.getSetting('order'))
                },
                columnConfig: {
                    fields: (this.getSetting('fields') &&
                        this.getSetting('fields').split(',')) || [],
                    plugins: [{
                        ptype: 'rallycolumncardcounter'
                    }]
                },
            };
            if (this.getSetting('showRows')) {
                Ext.merge(boardConfig, {
                    rowConfig: {
                        field: this.getSetting('rowsField'),
                        sortDirection: 'ASC'
                    }
                });
            }
            if (this._shouldDisableRanking()) {
                boardConfig.enableRanking = false;
                boardConfig.enableCrossColumnRanking = false;
                boardConfig.cardConfig.showRankMenuItems = false;
            }
            return boardConfig;
        },

        getSettingsFields: function() {
            var config = {
                context: this.getContext(),
            }
            return Rally.apps.board.Settings.getFields(config);
        },

        _shouldDisableRanking: function() {
            return this.getSetting('type').toLowerCase() === 'task' &&
                (!this.getSetting('showRows') || this.getSetting('showRows') &&
                    this.getSetting('rowsField').toLowerCase() !== 'workproduct');
        },

        _addBoard: function() {
            var gridArea = this.down('#grid-area')
            gridArea.removeAll();
            gridArea.add(this._getGridBoardConfig());
        },

        onTimeboxScopeChange: function(timeboxScope) {
            this.callParent(arguments);
            this._addBoard();
        },

        _getFilters: function() {
            var queries = [],
                timeboxScope = this.getContext().getTimeboxScope();
            if (this.getSetting('query')) {
                queries.push(Rally.data.QueryFilter.fromQueryString(this.getSetting('query')));
            }
            if (timeboxScope && timeboxScope.isApplicable(this.model)) {
                queries.push(timeboxScope.getQueryFilter());
            }
            var ancestorFilter = this.ancestorFilterPlugin.getFilterForType(this.model.typePath);
            if (ancestorFilter) {
                queries.push(ancestorFilter);
            }

            return queries;
        },

        searchAllProjects: function() {
            return this.ancestorFilterPlugin.getIgnoreProjectScope();
        },
    });
})();
